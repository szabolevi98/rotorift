const codePattern=/^[A-F0-9]{6}$/;
export function roomInvite(url,code,spectator=false){
  if(!codePattern.test(code))throw Error('Invalid room');
  const link=new URL(url);link.search='';link.hash='';
  link.searchParams.set('room',code);
  if(spectator)link.searchParams.set('watch','1');
  return link.href;
}
export function parseRoomInvite(url){
  const query=new URL(url).searchParams,code=(query.get('room')??'').toUpperCase();
  return codePattern.test(code)?{code,spectator:query.get('watch')==='1'}:null;
}
