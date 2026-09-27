import assert from 'node:assert/strict';
import {bestCatalogMatch,floorFromSpeech,floorOnlyRequest} from '../traveler-app/app/src/main/assets/web/voice-parse.js';

for(const phrase of ['floor 5','5th floor','fifth floor','I want to go to floor 5','take me to the fifth level'])assert.equal(floorFromSpeech(phrase),5,phrase);
assert.equal(floorFromSpeech('garden level'),0);
assert.equal(floorFromSpeech('room 6618'),null);
assert(floorOnlyRequest('I want to go to 5th floor'));
assert(!floorOnlyRequest('bathroom on floor 5'));
assert(!floorOnlyRequest('room 5618'));
const buildings=[
 {id:'morgridge',name:'Morgridge Hall'},
 {id:'union',name:'Memorial Union'},
 {id:'library',name:'College Library'},
 {id:'discovery',name:'Discovery Building'},
 {id:'chazen',name:'Chazen Museum of Art'}
];
const match=value=>bestCatalogMatch(value,buildings,{aliases:{morgridge:['morgridge'],union:['the union'],chazen:['chazen']}})?.item.id;
assert.equal(match('morgridge'),'morgridge');
assert.equal(match('I am in Morgridge on the first floor'),'morgridge');
assert.equal(match('morgrige'),'morgridge');
assert.equal(match('the union'),'union');
assert.equal(match('chazen'),'chazen');
assert.equal(match('discovery'),'discovery');
assert.equal(match('something completely unrelated'),undefined);
console.log('Voice floor parsing and fuzzy mapped-option matching passed.');
