import test from "node:test";
import assert from "node:assert/strict";
import { Network } from "../web/net/client.js";

test("a color picked while connecting is sent after authentication and survives reconnect", () => {
  const oldSocket=globalThis.WebSocket,oldLocation=globalThis.location;
  class Socket {
    static OPEN=1;
    constructor(){this.readyState=1;this.sent=[];}
    send(raw){this.sent.push(JSON.parse(raw));}
  }
  globalThis.WebSocket=Socket;globalThis.location={protocol:"http:",host:"localhost:3015"};
  const network=new Network(()=>{});
  try {
    network.setColor("coral");network.connect("Pilot");network.ws.onopen();
    assert.equal(network.ws.sent[0].color,"coral");
    network.setColor("teal");assert.equal(network.ws.sent.length,1,"the color is queued during the handshake");
    network.ws.onmessage({data:JSON.stringify({type:"welcome",id:"pilot",token:"test",now:Date.now()})});
    assert.equal(network.ws.sent.find(m=>m.type==="appearance").color,"teal");
    network.setColor("violet");assert.equal(network.ws.sent.at(-1).color,"violet");
    clearInterval(network.pingTimer);network.ready=false;network.connect("Pilot");network.ws.onopen();
    assert.equal(network.ws.sent[0].color,"violet","new hello restores the current color");
  } finally {
    clearInterval(network.pingTimer);clearTimeout(network.retry);
    globalThis.WebSocket=oldSocket;globalThis.location=oldLocation;
  }
});
