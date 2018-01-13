const async = require('async');

async.auto(
  {
    one: callback => {
      callback(null, 1);
    },
    two: callback => {
      setTimeout(_ => callback(null, 2, 3), 1000);
    },
    three: [
      'one',
      'two',
      (results, callback) => {
        console.log(results);

        callback();
      }
    ]
  },
  () => {
    console.log('ok');
  }
);

console.log('end');
