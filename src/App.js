import React, { useState, useEffect } from 'react';
import Tabs from 'react-bootstrap/Tabs';
import Timestamp from 'react-timestamp';
import Tab from 'react-bootstrap/Tab';
import Nav from './components/Nav';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import Send from './components/Send';
import Cycles from './components/Cycles';
import Balances from './components/Balances';
import Account from './components/Account';
import Login from './components/Login';
import Lockscreen from './components/Lockscreen';
import {ICPLedger} from './ic/ledger.js';
import LoadingOverlay from 'react-loading-overlay';

import Button from 'react-bootstrap/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';

//Helpers
var _defaultDb = {
  accounts : [
    ["Main", 
      []
    ]
  ],
  identity : {
    type : false,
    principal : false
  }
};
var appData = {
  accounts : [],
  identity : {
    type : false,
    principal : false
  }
};
var UNLOCKED = false, ACTIVE = false, INTV = false;
function initDb(){
  var t = localStorage.getItem('_db');
  if (t){
    ACTIVE = true; //Wallet is active
    t = JSON.parse(t);
    t.accounts.map(async (a, i) => {
      var _b = [];
      var _a = ICPLedger.p2aid(t.identity.principal, i);
      _b.push({
        name : "Internet Computer",
        symbol : "ICP",
        amount : "Loading",
        decimals : 8,
        transactions : false
      });
      a[1].map(t => {
        _b.push({
          id : t.id,
          name : t.name,
          symbol : t.symbol,
          decimals : t.decimals,
          amount : "Loading",
          transactions : []
        });
        return true;
      });
      appData.accounts.push({
        name : a[0],
        address : _a,
        balances : _b
      });
    });
    appData.identity = t.identity;
  }
}
function newDb(identity){
  var tc = Object.assign({}, _defaultDb);
  tc.identity = identity;
  localStorage.setItem('_db', JSON.stringify(tc));
  initDb();
}
function updateDb(accounts){
  var updatedDb = {
    accounts : [],
    identity : appData.identity,
  };
  accounts.map(a => {
    var _b = [];
    a.balances.map((b, i) => {
      if (i === 0) return false;
      _b.push({
        id : b.id,
        name : b.name,
        symbol : b.symbol,
        decimals : b.decimals,
      });
      return true;
    });
    updatedDb.accounts.push([a.name, _b]);
    return true;
  });
  localStorage.setItem('_db', JSON.stringify(updatedDb));
}
initDb();
var loaderCb = false;
//Render
function App() {
  const [currentAccount, _currentAccount] = useState(0);
  const [accounts, _accounts] = useState(appData.accounts);
  const [currentToken, _currentToken] = useState(0);
  const [balances, _balances] = useState((appData.accounts.length ? appData.accounts[currentAccount].balances : []));
  const [currentAccountName, _currentAccountName] = useState((appData.accounts.length ? appData.accounts[currentAccount].name : ""));
  const [unlocked, _unlocked] = useState(UNLOCKED);
  const [active, _active] = useState(ACTIVE);
  const [isLoaderActive, _isLoaderActive] = useState(false);
  const [connectionType, _connectionType] = useState(appData.identity.type);
  const [showError, _showError] = useState(false);
  const [errorText, _errorText] = useState("");
  
  useEffect(() => {
    if (loaderCb){
      loaderCb();
      loaderCb = false;
    }
  }, [isLoaderActive]);
  useEffect(() => {
    ICPLedger.init().then(() => {
      var checkLoad = ICPLedger.load(appData.identity);
      if (checkLoad && checkLoad.principal == appData.identity.principal) {
        UNLOCKED = true;
        _unlocked(UNLOCKED)
      }
    });
    setTimeout(fetchAllData, 1000);
    if (INTV === false)
      INTV = setInterval(fetchAllData, 10000);
    
  }, []);
  function error(t){
    _errorText(t);
    _showError(true);
  }
  function fetchAllData(){
    appData.accounts.map((a,i) => {
      a.balances.map((b,j) => {
        if (j === 0) {
          ICPLedger.getBalance(appData.accounts[i].address, 8).then(_b => {
            if (!ACTIVE) return false;
            if (!UNLOCKED) return false;
            ICPLedger.getTransactions(appData.accounts[i].address, i).then(ts => {
              if (!ACTIVE) return false;
              if (!UNLOCKED) return false;       
              appData.accounts[i].name = appData.accounts[i].name;
              appData.accounts[i].balances[j].amount = _b;
              appData.accounts[i].balances[j].transactions = ts;
              _accounts(arr => [...appData.accounts]);
            });
          });
        } else {
          ICPLedger.getTokenBalance(b.id, appData.accounts[i].address, appData.accounts[i].balances[j].decimals).then(_b => {
            if (!ACTIVE) return false;
            if (!UNLOCKED) return false;
            appData.accounts[i].name = appData.accounts[i].name;
            appData.accounts[i].balances[j].amount = _b;
            appData.accounts[i].balances[j].transactions = [];
            _accounts(arr => [...appData.accounts]);
          }).catch(e => {
            if (e.message.includes("Specified sender delegation has expired")){
              lockWallet();
            }
          });
        }
        return true;
      })
      return true;
    });
  }
  function loader(t, fn){
    if (fn) loaderCb = fn;
    _isLoaderActive(t);
  }
  function send(toaddress, amount, fee, memo){
    return new Promise((resolve, reject) => {
      
      var p = (currentToken == 'icp' ? ICPLedger.transfer(toaddress, fee, memo, currentAccount, amount) : ICPLedger.transferTokens(
        balances[currentToken].id, 
        toaddress, 
        fee, 
        memo, 
        currentAccount, 
        amount, 
        balances[currentToken].decimals));
      p.then(b => {
        resolve(b);
      }).catch(e => {
        reject(e);
      });
    });
  }
  function cycles(canisterid, amount, fee){
    return new Promise((resolve, reject) => {
      var p = ICPLedger.convertCycles(canisterid, fee, currentAccount, amount);
      p.then(b => {
        resolve(b);
      }).catch(e => {
        reject(e);
      });
    });
  }
  function updateName(v){
    appData.accounts[currentAccount].name = v;
    _accounts(arr => [...appData.accounts]);
    _currentAccountName(v);
    updateDb(appData.accounts);
  }
  function deleteAccount(){
    var t = currentAccount;
    changeAccount(0);
    appData.accounts.splice(t, 1);
    _accounts( arr => [...appData.accounts]);
    updateDb(appData.accounts);
  }
  function addToken(name, symbol, decimals, id){
    if (id == "qz7gu-giaaa-aaaaf-qaaka-cai" && currentAccount != 0) return error("HZLD can only be added to your main account as it is connected to your Principal (not your address)");
    if (appData.accounts[currentAccount].balances.findIndex(x => x.id === id) >= 0) return error("This token has already been added to this account");
    appData.accounts[currentAccount].balances.push({
      id : id,
      name : name,
      symbol : symbol,
      decimals : decimals,
      amount : "Loading",
      transactions : []
    });
    _accounts( arr => [...appData.accounts]);
    updateDb(appData.accounts);
    fetchAllData();
    changeToken(appData.accounts[currentAccount].balances.length-1);
  }
  function changeToken(i){
    _currentToken(i);
  }
  function metadata(tid){
    return ICPLedger.getTokenMetadata(tid);
  }
  function changeAccount(i){
    _currentAccount(i);
    _currentAccountName(appData.accounts[i].name);
    _balances(appData.accounts[i].balances);
    _currentToken(0);
  }
  //TODO
  function unlock(ll, t){
    loader(true);
    ll.then(identity => {      
      loader(false);
      UNLOCKED = true;
      _unlocked(true);
      if (INTV === false)
        INTV = setInterval(fetchAllData, 5000);
      _connectionType(identity.type);
      _accounts(appData.accounts);
      _balances(appData.accounts[0].balances);
    });
  }
  function login(ll, t){
    loader(true);
    ll.then(identity => {   
      newDb(identity);
      _connectionType(identity.type);
      _accounts(appData.accounts);
      _balances(appData.accounts[0].balances);
      _currentToken(0);
      _currentAccount(0);
      _active(true);
      _unlocked(true);
      loader(false);
      ACTIVE = true;
      UNLOCKED = true;
      if (INTV === false)
        INTV = setInterval(fetchAllData, 5000);
    });
  }
  function lockWallet(){
    ICPLedger.lock(appData.identity);
    UNLOCKED = false;
    _unlocked(UNLOCKED);
    clearInterval(INTV);
    INTV = false;
  }
  function clearWallet(){
    ICPLedger.clear(appData.identity);
    UNLOCKED = false;
    ACTIVE = false;
    _unlocked(UNLOCKED);
    _active(ACTIVE);
    
    //Clear data
    _accounts([]);
    _balances([]);
    _currentToken(0);
    _currentAccount(0);
    localStorage.removeItem('_db')
    appData = {
      accounts : [],
      identity : {
        type : false,
        principal : false
      }
    }
    clearInterval(INTV);
    INTV = false;
  }
  function addAccount(){
    var _a = ICPLedger.p2aid(appData.identity.principal, accounts.length);
    appData.accounts.push({
      name : "Account " + (appData.accounts.length),
      address : _a,
      balances : [{
        name : "Internet Computer",
        symbol : "ICP",
        amount : 0,
        transactions : []
      }]
    });
    _accounts( arr => [...appData.accounts]);
    updateDb(appData.accounts);
    changeAccount(appData.accounts.length-1);
  }
  function compressAddress(a){
    return a.substr(0, 32) + "...";
  }
  function displaydate(d){
    return new Date(d).toString();
  }
  function numf(n, d){
    if (n === "N/A") return n;
    d = (d ?? 2);
    return n.toFixed(d).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  }
  
  return (
    <LoadingOverlay
    active={isLoaderActive}
    spinner
    text='Loading, please wait..'
    >
    { unlocked ? 
    <div className="sb-nav-fixed">
      <Nav clearWallet={clearWallet} lockWallet={lockWallet} principal={appData.identity.principal} />
      <div id="layoutSidenav">
        <Sidebar connectionType={connectionType} changeAccount={changeAccount} currentAccount={currentAccount} addAccount={addAccount} accounts={accounts} />
        <div id="layoutSidenav_content">
          <main>
              <div className="container-fluid px-4">
                  <Account currentAccountName={currentAccountName} updateName={updateName} accounts={accounts} currentAccount={currentAccount} setAccounts={_accounts} deleteAccount={deleteAccount}/>
                  <hr />
                  <Balances addToken={addToken} loader={loader} metadata={metadata} error={error} balances={balances} currentToken={currentToken} changeToken={changeToken} />
                  <div className="row">
                    <div className="col">
                      <Tabs defaultActiveKey="activity" id="uncontrolled-tab-example" className="mb-3">
                        <Tab eventKey="activity" title="Activity">
                          <h3>Transactions</h3>
                          { balances[currentToken].transactions === false ? "" : (balances[currentToken].transactions.length === 0 ? "" :
                          <div className="tx tx-head row">
                            <div className="col-lg-1 col-md-2 col-sm-12 tx-1">
                              <span>Date</span>
                            </div>
                            <div className="col-lg-9 col-md-7 col-sm-12 tx-2">
                              <span>Description:</span>
                            </div>
                            <div className="col-lg-2 col-md-3 col-sm-12 tx-3">
                              <span>Amount:</span>
                            </div>
                          </div>)}
                          { balances[currentToken].transactions === false ? "Loading..." : (balances[currentToken].transactions.length === 0 ? "No transactions yet" : 
                          balances[currentToken].transactions.map((t, i) => {
                            return (
                            <div key={i} className={t.to === accounts[currentAccount].address ? "tx row tx-in" : "tx row tx-out"}>
                              <div className="col-lg-1 col-md-2 col-sm-12 tx-1">
                                <span><Timestamp relative autoUpdate date={t.timestamp} /></span>
                              </div>
                              <div className="col-lg-9 col-md-7 col-sm-12 tx-2">
                               {t.from === accounts[currentAccount].address ? 
                                <>
                                Sent <strong>{numf(t.amount, 4)} {balances[currentToken].symbol}</strong> to {t.to} with a <strong>{t.fee} ICP</strong> Fee<br />(<a href={ "https://ic.rocks/transaction/" + t.hash} target="_blank" rel="noreferrer">View Transaction</a>)
                                </> : 
                                <>
                                Received <strong>{numf(t.amount, 4)} {balances[currentToken].symbol}</strong> from {t.from}<br />(<a href={ "https://ic.rocks/transaction/" + t.hash} target="_blank" rel="noreferrer">View Transaction</a>)
                               </>}
                              </div>
                              <div className="col-lg-2 col-md-3 col-sm-12 tx-3">
                               {t.from === accounts[currentAccount].address ?
                               <>-{numf(t.amount+t.fee, 4)} {balances[currentToken].symbol}</> :
                               <>+{numf(t.amount, 4)} {balances[currentToken].symbol}</>}
                              </div>
                            </div>)
                          }))} 
                        </Tab>
                        <Tab eventKey="send" title="Send">
                          <h3>Send {balances[currentToken].symbol}</h3>
                          <Send symbol={balances[currentToken].symbol} currentToken={balances[currentToken].id ?? 'icp'} loader={loader} send={send} currentBalance={balances[currentToken].amount} />
                        </Tab>
                        <Tab eventKey="cycles" title="Topup Canisters">
                          <h3>Topup Canisters with ICP</h3>
                          <Cycles currentToken={0} loader={loader} cycles={cycles} currentBalance={balances[0].amount} />
                        </Tab>
                      </Tabs>
                    </div>
                  </div>
              </div>
          </main>
          <Footer />
        </div>
      </div>
    </div> :
    ( active ?
    <Lockscreen identity={appData.identity} error={error} loader={loader} unlock={unlock} clearWallet={clearWallet} /> :
    <Login error={error} loader={loader} login={login} /> )}
    <Dialog
      open={showError}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{"Something went wrong"}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
        {errorText}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => _showError(false)} variant="secondary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
    </LoadingOverlay>
  );
}
export default App;
