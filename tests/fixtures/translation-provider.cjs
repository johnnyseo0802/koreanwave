// Loaded only by the isolated browser test child process. Never application code.
// Intercepts the FIXED provider endpoint before Next wraps fetch; forwards solely
// to our local fixture. No external translation or production API traffic.
if (process.env.KWC_TRANSLATION_FIXTURE !== 'local-4072') throw Error('Fixture only');
const original = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url === 'https://api.openai.com/v1/responses') {
    return original('http://127.0.0.1:4072/provider', init);
  }
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw Error('External fixture request blocked');
  return original(input, init);
};
