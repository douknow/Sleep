const r = require('request');
const async = require('async');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const mongoose = require('mongoose');
const q = require('q');
const fs = require('fs');

const getProxy = require('./proxy');

mongoose.Promise = q.Promise;

mongoose.connect(process.env.MONGODB_URI, {
  useMongoClient: true
});

let message = fs
  .readFileSync(__dirname + '/log/log.log', 'utf8')
  .trim()
  .split('\n');

const ArticalDB = mongoose.model(
  'artical',
  new mongoose.Schema({
    title: String,
    url: String,
    images: Array,
    tags: Array,
    date: Date
  })
);

let saveOK = 0;
let pageOK = 0;

function getAllUrl(pageNumber, callback) {
  const baseUrl = `http://www.meizitu.com/a/more_${pageNumber}.html`;

  let proxy = getRandomProxy();

  let options = {
    uri: baseUrl,
    encoding: null,
    gzip: true,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36',
      Connection: 'keep-alive'
    },
    host: proxy.host,
    port: proxy.port
  };

  r.get(options, (err, res, body) => {
    if (err) {
      return getAllUrl(pageNumber, callback);
    }

    let html = iconv.decode(body, 'gb2312');

    const $ = cheerio.load(html);

    let ul = $('div#container ul.wp-list.clearfix');
    let lis = ul.find('li.wp-item');

    let willSave = [];
    let pageAllArtical = [];

    lis.each((i, elem) => {
      let title = $(elem)
        .find('h3 a')
        .text();
      let url = $(elem)
        .find('a')
        .attr('href');

      pageAllArtical.push({ title, url });
    });

    async.each(
      pageAllArtical,
      (artical, callback2) => {
        ArticalDB.find({ url: artical.url })
          .then(data => {
            if (data.length === 0) willSave.push(artical);
            callback2();
          })
          .catch(err => {
            console.log(err);
            log('ERROR:' + err);
            willSave.push({ title, url });
            callback2();
          });
      },
      () => {
        async.eachLimit(willSave, 5, saveArtical, err => {
          pageOK++;
          console.log(`完成${pageOK}页,${willSave.length}条数据`);

          log(`完成${pageOK}页,${willSave.length}条数据`);

          if (willSave.length < lis.length) process.exit();
          callback();
        });
      }
    );
  });
}

function log(msg) {
  message.push(new Date().toLocaleString() + ' ---- ' + msg);
  if (message.length > 300) message.unshift();
  fs.writeFileSync(__dirname + '/log/log.log', message.join('\n'));
}

function saveArtical(artical, callback) {
  let proxy = getRandomProxy();
  let options = {
    uri: artical.url,
    encoding: null,
    gzip: true,
    host: proxy.host,
    port: proxy.port
  };

  r.get(options, (err, res, body) => {
    if (err) {
      return saveArtical(artical, callback);
    }

    let html = iconv.decode(body, 'gb2312');

    const $ = cheerio.load(html);

    let info = $('div.postmeta.clearfix');
    let tags = info
      .find('p')
      .text()
      .split(',')
      .reduce((tags, tag) => {
        tag = tag.trim().replace('Tags:', '');
        return tag === '' ? tags : tags.concat([tag]);
      }, []);

    let day = info.find('.metaLeft .day').text();
    let yearAndMonth = info
      .find('.metaLeft .month_Year')
      .text()
      .split('\xa0');
    let date = yearAndMonth[1] + '-' + yearAndMonth[0] + '-' + day;
    if (date.includes('undefined')) date = '1009-01-01';

    let images = [];
    $('div#picture img').each((i, elem) => {
      images.push($(elem).attr('src'));
    });

    if (images.length === 0) {
      $('div.postContent p:first-child img').each((i, elem) => {
        images.push($(elem).attr('src'));
      });
    }

    let data = {
      title: artical.title,
      url: artical.url,
      date,
      tags,
      images
    };

    new ArticalDB(data)
      .save(data => {
        console.log(`保存了${++saveOK}条`);
        callback();
      })
      .catch(error => {
        console.log('save error' + error + artical);
        callback();
      });
  });
}

let proxies = {};

getProxy()
  .then(data => {
    proxies = data;

    let pages = [];

    for (let i = 1; i <= 72; i++) {
      pages.push(i);
    }

    async.eachLimit(pages, 1, getAllUrl, err => {
      if (err) console.log(err);

      console.log('OK');
      process.exit();
    });

    // saveArtical(
    //   {
    //     title: '要是你家有这样的女仆，还想上班去？',
    //     url: 'http://www.meizitu.com/a/5552.html'
    //   },
    //   () => {}
    // );
  })
  .catch(errors => {
    throw errors;
  });

function getRandomProxy() {
  return proxies[Math.floor(Math.random() * proxies.length)];
}
