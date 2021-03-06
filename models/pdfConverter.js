'use strict';
const Promise = require('bluebird');
const log = require('../lib/logger');
const FileHelper = require('../lib/filehelper');
const fs = require('fs');
const hyperid = require('hyperid')({ urlSafe: true });
const HTMLToPDF = require('html5-to-pdf');
const path = require('path');

const convertHTML2PDF = (htmlPage, type) =>
  new Promise((resolve, reject) => {
    const inputFile = `${hyperid()}.html`;
    const outputFile = `${hyperid()}.pdf`;
    const options = {
      pdf: {
        format: 'A4',
        printBackground: true
      },
      launchOptions: {
        args: [
          '--no-sandbox',
          '--site-per-process'
        ]
      },
      inputPath: inputFile,
      outputPath: outputFile,
      renderDelay: 1000,
      templatePath: path.resolve('templates/html5bp')
    };

    if (!FileHelper.isImage(type)) {
      options.pdf.margin = {
        top: 100,
        right: 100,
        bottom: 100,
        left: 100
      };
    }

    const newHtmlPage = htmlPage.replace(/[\u2028\u2029]/g, '');

    fs.writeFile(inputFile, newHtmlPage, (err) => {
      if (err) {
        return reject(err);
      }

      const htmlToPDF = new HTMLToPDF(options);
      htmlToPDF.start()
        .then(() => htmlToPDF.build())
        .then(() => {
          fs.unlink(inputFile, (delErr) => {
            if (delErr) {
              log.warn('Failed to delete inputFile', inputFile);
            }
            log.debug(`Deleted input file: ${inputFile}`);
            const rs = fs.createReadStream(outputFile);
            resolve(rs);

            rs.on('end', () => {
              fs.unlink(outputFile, () => {
                log.debug(`Deleted output file: ${outputFile}`);
              });
            });
          });
        })
        .then(() => htmlToPDF.close())
        .catch(buildErr => reject(buildErr));
    });
  });

exports.convert = (data, documentPath, type, res) => {
  convertHTML2PDF(data, type).then((stream) => {
    res.writeHead(200, { // eslint-disable-line
      'Content-Type': 'application/pdf',
      'Access-Control-Allow-Origin': '*',
      'Content-Disposition': 'attachment; filename="output.pdf"'
    });

    stream.pipe(res);
  }).catch((err) => {
    log.warn('Failed to convert document: ', err);
    res.status(415).end('Unable to convert the supplied document');
  });
};
