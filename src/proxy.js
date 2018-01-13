const r = require('request');
const cheerio = require('cheerio');

module.exports = _ => {
  let proxies = [];

  const options = {
    uri: 'https://www.kuaidaili.com/free/'
  };

  return new Promise((resolve, reject) => {
    r.get(options, (err, res, body) => {
      if (err) throw err;

      const $ = cheerio.load(body);

      let trs = $('table.table.table-bordered.table-striped tbody tr');
      trs.each((i, elem) => {
        host = $(elem)
          .find('td:nth-child(1)')
          .text();
        port = $(elem)
          .find('td:nth-child(2)')
          .text();

        proxies.push({ host, port });
      });

      return resolve(proxies);
    });
  });
};
