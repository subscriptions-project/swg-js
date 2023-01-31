const minimist = require('minimist');

// Parse args before *and* after a `--` divider.
// This lets us pass args that some tools (ex: Rollup) reject,
// by placing the args *after* a `--` divider.
//   Ex: npx rollup -- --swgArg=1234
const args = minimist(process.argv.slice(2), {'--': true});
const extraArgs = minimist(args['--']);

module.exports = Object.assign({}, args, extraArgs);
