import assert from 'node:assert/strict';
process.env.ANTHROPIC_API_KEY = 'offline-fixture';
process.env.BOT_USAGE_LOG = 'off';
const { verifyXray, parseXrayVerdict, fatalQaError } = await import('../src/verify.js');
const cond: any = { diagnosis: 'SECRET_INTENDED_ANSWER', view: 'AP shoulder', keyFindings: 'displaced head', requiredObservations: ['displaced head'] };
const valid = { unexplainedFindings: [], singleAnswerSupported: true, diagnosticReason: 'Head below the glenoid with superior shaft direction', plausible: true, depictsDiagnosis: true, correctBodyPart: true, severity: 'pass', defects: [], observations: [{ expected: 'displaced head', observed: 'head below glenoid', assessable: true, matches: true }] };
assert.equal(parseXrayVerdict(JSON.stringify({ ...valid, singleAnswerSupported: false }), cond).ok, false);
assert.equal(parseXrayVerdict(JSON.stringify({ ...valid, unexplainedFindings: ['unexpected osteochondroma'] }), cond).ok, false);
assert.equal(fatalQaError(new Error('Your credit balance is too low')), true);
assert.equal(fatalQaError({ status: 401 }), true);
assert.equal(fatalQaError(new Error('temporary overload')), false);
let calls = 0;
globalThis.fetch = async (_url, init) => {
  calls++;
  const body = String(init?.body);
  if (calls === 1) assert.ok(!body.includes('SECRET_INTENDED_ANSWER') && !body.includes('displaced head'), 'first call must be genuinely blind');
  else { assert.match(body, /SECRET_INTENDED_ANSWER/); assert.match(body, /BLIND_READING_FIXTURE/); }
  const result = calls === 1 ? { findings: ['BLIND_READING_FIXTURE'], differential: ['inferior shoulder dislocation'], anatomyConcerns: [] } : valid;
  return new Response(JSON.stringify({ id: 'fixture', type: 'message', role: 'assistant', model: 'claude-sonnet-4-6', stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: JSON.stringify(result) }] }), { headers: { 'content-type': 'application/json' } });
};
const verdict = await verifyXray(Buffer.from('fixture'), cond);
assert.equal(calls, 2);
assert.equal(verdict.ok, true);
assert.deepEqual(verdict.blindRead?.findings, ['BLIND_READING_FIXTURE']);
console.log('PASS separate blind request, retained evidence, ambiguous answer hold and unexpected-lesion hold');
