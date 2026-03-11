import https from 'https';

const url = 'https://corsproxy.io/?' + encodeURIComponent('https://github.com/Wellers20/OcenIVATel/releases/download/1.0.0/dog+3d+model.obj');

https.get(url, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
});
