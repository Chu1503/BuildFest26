import assert from 'node:assert/strict';
import {floorFromSpeech,floorOnlyRequest} from '../traveler-app/app/src/main/assets/web/voice-parse.js';

for(const phrase of ['floor 5','5th floor','fifth floor','I want to go to floor 5','take me to the fifth level'])assert.equal(floorFromSpeech(phrase),5,phrase);
assert.equal(floorFromSpeech('garden level'),0);
assert.equal(floorFromSpeech('room 6618'),null);
assert(floorOnlyRequest('I want to go to 5th floor'));
assert(!floorOnlyRequest('bathroom on floor 5'));
assert(!floorOnlyRequest('room 5618'));
console.log('Voice floor normalization and floor-only destination detection passed.');
