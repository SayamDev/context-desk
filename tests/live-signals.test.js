import test from 'node:test';
import assert from 'node:assert/strict';
import {isLaugh,detectChatSpike,detectChatLaughter,chatSource,parseTwitchLine,parseYouTubeChatLine} from '../lib/live-signals.js';
test('recognises laughing in chat across languages without matching ordinary words',()=>{
  for(const text of ['LMAO','lolll','KEKW','OMEGALUL','hahaha','jajaja','kkkkk','wwww','5555','ههههه','ㅋㅋㅋ','哈哈哈','😂','that was 💀'])assert.equal(isLaugh(text),true,text);
  for(const text of ['hello','ha','lollipop','Kekule','what','100','okay','haha_bot is here'.replace('haha','ha')])assert.equal(isLaugh(text),false,text);
});
test('chat spikes need a baseline and a clear jump',()=>{
  const calm=[3,4,2,5,3,4];
  assert.equal(detectChatSpike(calm,14),true);
  assert.equal(detectChatSpike(calm,9),false);
  assert.equal(detectChatSpike(calm.slice(0,3),40),false);
  assert.equal(detectChatSpike([0,0,0,0,0,0],5),false);
});
test('chat laughter needs several viewers laughing, not one',()=>{
  assert.equal(detectChatLaughter({count:12,laughs:5}),true);
  assert.equal(detectChatLaughter({count:40,laughs:5}),false);
  assert.equal(detectChatLaughter({count:3,laughs:3}),false);
});
test('chat sources: Twitch channels and YouTube streams; Kick has no chat signal',()=>{
  assert.deepEqual(chatSource('https://www.twitch.tv/SomeStreamer'),{kind:'twitch',channel:'somestreamer'});
  assert.equal(chatSource('https://www.twitch.tv/videos/123'),null);
  assert.deepEqual(chatSource('https://www.youtube.com/@LofiGirl/live'),{kind:'youtube'});
  assert.equal(chatSource('https://kick.com/someone'),null);
});
test('reads chat text only, never author identity',()=>{
  assert.deepEqual(parseTwitchLine('@badges=x :a!a@a.tmi.twitch.tv PRIVMSG #chan :KEKW no way'),{text:'KEKW no way'});
  assert.deepEqual(parseTwitchLine('PING :tmi.twitch.tv'),{ping:':tmi.twitch.tv'});
  const yt=JSON.stringify({replayChatItemAction:{actions:[{addChatItemAction:{item:{liveChatTextMessageRenderer:{message:{runs:[{text:'lol '},{emoji:{emojiId:'😂',shortcuts:[':face-with-tears-of-joy:']}}]},authorName:{simpleText:'@someone'},timestampUsec:'1793567140789038'}}}}]}});
  assert.deepEqual(parseYouTubeChatLine(yt),[{text:'lol 😂',at:1793567140789.038}]);
  assert.deepEqual(parseYouTubeChatLine('not json'),[]);
});
