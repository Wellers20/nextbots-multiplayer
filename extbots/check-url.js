import https from 'https';

https.get('https://github.com/Wellers20/OcenIVATel/releases/download/1.0.0/dog+3d+model.obj', (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  console.log('Location:', res.headers.location);
});
