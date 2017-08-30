/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

var gulp = require('gulp-help')(require('gulp'));
var path = require('path');
var srcGlobs = require('../config').presubmitGlobs;
var util = require('gulp-util');
var through2 = require('through2');

var dedicatedCopyrightNoteSources = /(\.js|\.css|\.go)$/;

var es6polyfill = 'Not available because we do not currently' +
    ' ship with a needed ES6 polyfill.';

var requiresReviewPrivacy =
    'Usage of this API requires dedicated review due to ' +
    'being privacy sensitive. Please file an issue asking for permission' +
    ' to use if you have not yet done so.';

var privateServiceFactory = 'This service should only be installed in ' +
    'the whitelisted files. Other modules should use a public function ' +
    'typically called serviceNameFor.';

var shouldNeverBeUsed =
    'Usage of this API is not allowed - only for internal purposes.';

var backwardCompat = 'This method must not be called. It is only retained ' +
    'for backward compatibility during rollout.';

var realiasGetMode = 'Do not re-alias getMode or its return so it can be ' +
    'DCE\'d. Use explicitly like "getMode().localDev" instead.';

// Terms that must not appear in our source files.
var forbiddenTerms = {
  'DO NOT SUBMIT': '',
  'describe\\.only': '',
  'describes.*\\.only': '',
  'it\\.only': '',
  'Math\.random[^;()]*=': 'Use Sinon to stub!!!',
  'sinon\\.(spy|stub|mock)\\(': {
    message: 'Use a sandbox instead to avoid repeated `#restore` calls',
  },
  '(\\w*([sS]py|[sS]tub|[mM]ock|clock).restore)': {
    message: 'Use a sandbox instead to avoid repeated `#restore` calls',
  },
  'sinon\\.useFake\\w+': {
    message: 'Use a sandbox instead to avoid repeated `#restore` calls',
  },
  'sandbox\\.(spy|stub|mock)\\([^,\\s]*[iI]?frame[^,\\s]*,': {
    message: 'Do NOT stub on a cross domain iframe! #5359\n' +
        '  If this is same domain, mark /*OK*/.\n' +
        '  If this is cross domain, overwrite the method directly.',
  },
  'console\\.\\w+\\(': {
    message: 'If you run against this, use console/*OK*/.log to ' +
      'whitelist a legit case.',
    whitelist: [
      'src/main.js',
    ],
    checkInTestFolder: true,
  },
  '(?:var|let|const) +IS_DEV +=': {
    message: 'IS_DEV local var only allowed in mode.js',
    whitelist: [
      'src/mode.js',
    ],
  },
  '\\.prefetch\\(': {
    message: 'Do not use preconnect.prefetch, use preconnect.preload instead.',
  },
 'cookie\\W': {
    message: requiresReviewPrivacy,
    whitelist: [
    ],
  },
  'getCookie\\W': {
    message: requiresReviewPrivacy,
    whitelist: [
    ],
  },
  'setCookie\\W': {
    message: requiresReviewPrivacy,
    whitelist: [
    ],
  },
  'eval\\(': {
    message: shouldNeverBeUsed,
    whitelist: [
    ],
  },
  'localStorage': {
    message: requiresReviewPrivacy,
    whitelist: [
    ],
  },
  'sessionStorage': {
    message: requiresReviewPrivacy,
    whitelist: [
    ],
  },
  'indexedDB': {
    message: requiresReviewPrivacy,
    whitelist: [
    ],
  },
  'openDatabase': requiresReviewPrivacy,
  'requestFileSystem': requiresReviewPrivacy,
  'webkitRequestFileSystem': requiresReviewPrivacy,
  'debugger': '',
  'style\\.\\w+ = ': {
    message: 'Use setStyle instead!',
    whitelist: [
    ],
  },
  'data:image/svg(?!\\+xml;charset=utf-8,)[^,]*,': {
    message: 'SVG data images must use charset=utf-8: ' +
        '"data:image/svg+xml;charset=utf-8,..."',
  },
  '(AMP|Amp|amp-|\\Wamp\\W)': 'Illegal AMP dependency',
};

var bannedTermsHelpString = 'Please review viewport service for helper ' +
    'methods or mark with `/*OK*/` or `/*REVIEW*/` and consult the __PROJECT__ team. ' +
    'Most of the forbidden property/method access banned on the ' +
    '`forbiddenTermsSrcInclusive` object can be found in ' +
    '[What forces layout / reflow gist by Paul Irish]' +
    '(https://gist.github.com/paulirish/5d52fb081b3570c81e3a). ' +
    'These properties/methods when read/used require the browser ' +
    'to have the up-to-date value to return which might possibly be an ' +
    'expensive computation and could also be triggered multiple times ' +
    'if we are not careful. Please mark the call with ' +
    '`object./*OK*/property` if you explicitly need to read or update the ' +
    'forbidden property/method or mark it with `object./*REVIEW*/property` ' +
    'if you are unsure and so that it stands out in code reviews.';

var forbiddenTermsSrcInclusive = {
  '\\.innerHTML(?!_)': bannedTermsHelpString,
  '\\.outerHTML(?!_)': bannedTermsHelpString,
  '\\.innerText(?!_)': bannedTermsHelpString,
  '\\.scrollX(?!_)': bannedTermsHelpString,
  '\\.scrollY(?!_)': bannedTermsHelpString,
  '\\.pageXOffset(?!_)': bannedTermsHelpString,
  '\\.pageYOffset(?!_)': bannedTermsHelpString,
  '\\.innerWidth(?!_)': bannedTermsHelpString,
  '\\.innerHeight(?!_)': bannedTermsHelpString,
  '\\.scrollingElement(?!_)': bannedTermsHelpString,
  '\\.computeCTM(?!_)': bannedTermsHelpString,
  '\\.scrollBy\\(': bannedTermsHelpString,
  '\\.scrollIntoView\\(': bannedTermsHelpString,
  '\\.scrollIntoViewIfNeeded\\(': bannedTermsHelpString,
  '\\.scrollTo\\(': bannedTermsHelpString,
  '\\.webkitConvertPointFromNodeToPage\\(': bannedTermsHelpString,
  '\\.webkitConvertPointFromPageToNode\\(': bannedTermsHelpString,
  'Text(Encoder|Decoder)\\(': {
    message: 'TextEncoder/TextDecoder is not supported in all browsers.' +
        'Please use UTF8 utilities from src/bytes.js',
    whitelist: [
    ],
  },
  'reject\\(\\)': {
    message: 'Always supply a reason in rejections. ' +
    'error.cancellation() may be applicable.',
    whitelist: [
    ],
  },
  '\\.getTime\\(\\)': {
    message: 'Unless you do weird date math (whitelist), use Date.now().',
    whitelist: [
    ],
  },
  '\\<\\<\\<\\<\\<\\<': {
    message: 'Unresolved merge conflict.',
  },
  '\\>\\>\\>\\>\\>\\>': {
    message: 'Unresolved merge conflict.',
  },
  '\\.trim(Left|Right)\\(\\)': {
    message: 'Unsupported on IE; use trim() or a helper instead.',
    whitelist: [
    ],
  },
};

// Terms that must appear in a source file.
var requiredTerms = {
  'Copyright 20(17|18) The __PROJECT__ Authors\\.':
      dedicatedCopyrightNoteSources,
  'Licensed under the Apache License, Version 2\\.0':
      dedicatedCopyrightNoteSources,
  'http\\://www\\.apache\\.org/licenses/LICENSE-2\\.0':
      dedicatedCopyrightNoteSources,
};


/**
 * Check if root of path is test/ or file is in a folder named test.
 * @param {string} path
 * @return {boolean}
 */
function isInTestFolder(path) {
  var dirs = path.split('/');
  return dirs.indexOf('test') >= 0;
}

function stripComments(contents) {
  // Multi-line comments
  contents = contents.replace(/\/\*(?!.*\*\/)(.|\n)*?\*\//g, function(match) {
    // Preserve the newlines
    var newlines = [];
    for (var i = 0; i < match.length; i++) {
      if (match[i] === '\n') {
        newlines.push('\n');
      }
    }
    return newlines.join('');
  });
  // Single line comments either on its own line or following a space,
  // semi-colon, or closing brace
  return contents.replace(/( |}|;|^) *\/\/.*/g, '$1');
}

/**
 * Logs any issues found in the contents of file based on terms (regex
 * patterns), and provides any possible fix information for matched terms if
 * possible
 *
 * @param {!File} file a vinyl file object to scan for term matches
 * @param {!Array<string, string>} terms Pairs of regex patterns and possible
 *   fix messages.
 * @return {boolean} true if any of the terms match the file content,
 *   false otherwise
 */
function matchTerms(file, terms) {
  var contents = stripComments(file.contents.toString());
  var relative = file.relative;
  return Object.keys(terms).map(function(term) {
    var fix;
    var whitelist = terms[term].whitelist;
    var checkInTestFolder = terms[term].checkInTestFolder;
    // NOTE: we could do a glob test instead of exact check in the future
    // if needed but that might be too permissive.
    if (Array.isArray(whitelist) && (whitelist.indexOf(relative) != -1 ||
        isInTestFolder(relative) && !checkInTestFolder)) {
      return false;
    }
    // we can't optimize building the `RegExp` objects early unless we build
    // another mapping of term -> regexp object to be able to get back to the
    // original term to get the possible fix value. This is ok as the
    // presubmit doesn't have to be blazing fast and this is most likely
    // negligible.
    var regex = new RegExp(term, 'gm');
    var index = 0;
    var line = 1;
    var column = 0;
    var match;
    var hasTerm = false;

    while ((match = regex.exec(contents))) {
      hasTerm = true;
      for (index; index < match.index; index++) {
        if (contents[index] === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
      }

      util.log(util.colors.red('Found forbidden: "' + match[0] +
          '" in ' + relative + ':' + line + ':' + column));
      if (typeof terms[term] == 'string') {
        fix = terms[term];
      } else {
        fix = terms[term].message;
      }

      // log the possible fix information if provided for the term.
      if (fix) {
        util.log(util.colors.blue(fix));
      }
      util.log(util.colors.blue('=========='));
    }

    return hasTerm;
  }).some(function(hasAnyTerm) {
    return hasAnyTerm;
  });
}


/**
 * Test if a file's contents match any of the
 * forbidden terms
 *
 * @param {!File} file file is a vinyl file object
 * @return {boolean} true if any of the terms match the file content,
 *   false otherwise
 */
function hasAnyTerms(file) {
  var pathname = file.path;
  var basename = path.basename(pathname);
  var hasTerms = false;
  var hasSrcInclusiveTerms = false;

  hasTerms = matchTerms(file, forbiddenTerms);

  var isTestFile = /^test-/.test(basename) || /^_init_tests/.test(basename)
      || /_test\.js$/.test(basename);
  if (!isTestFile) {
    hasSrcInclusiveTerms = matchTerms(file, forbiddenTermsSrcInclusive);
  }

  return hasTerms || hasSrcInclusiveTerms;
}

/**
 * Test if a file's contents fail to match any of the required terms and log
 * any missing terms
 *
 * @param {!File} file file is a vinyl file object
 * @return {boolean} true if any of the terms are not matched in the file
 *  content, false otherwise
 */
function isMissingTerms(file) {
  var contents = file.contents.toString();
  return Object.keys(requiredTerms).map(function(term) {
    var filter = requiredTerms[term];
    if (!filter.test(file.path)) {
      return false;
    }

    var matches = contents.match(new RegExp(term));
    if (!matches) {
      util.log(util.colors.red('Did not find required: "' + term +
          '" in ' + file.relative));
      util.log(util.colors.blue('=========='));
      return true;
    }
    return false;
  }).some(function(hasMissingTerm) {
    return hasMissingTerm;
  });
}

/**
 * Check a file for all the required terms and
 * any forbidden terms and log any errors found.
 */
function checkForbiddenAndRequiredTerms() {
  var forbiddenFound = false;
  var missingRequirements = false;
  return gulp.src(srcGlobs)
    .pipe(through2.obj(function(file, enc, cb) {
      forbiddenFound = hasAnyTerms(file) || forbiddenFound;
      missingRequirements = isMissingTerms(file) || missingRequirements;
      cb();
    }))
    .on('end', function() {
      if (forbiddenFound) {
        util.log(util.colors.blue(
            'Please remove these usages or consult with the __PROJECT__ team.'));
      }
      if (missingRequirements) {
        util.log(util.colors.blue(
            'Adding these terms (e.g. by adding a required LICENSE ' +
            'to the file)'));
      }
      if (forbiddenFound || missingRequirements) {
        process.exit(1);
      }
    });
}


gulp.task('check-rules', 'Run validation against files to check for forbidden ' +
  'and required terms', checkForbiddenAndRequiredTerms);
