import https from 'https';

const url = 'https://release-assets.githubusercontent.com/github-production-release-asset/1099124787/7d1492d4-270d-4e7f-b50b-b1da4e5339c8?sp=r&sv=2018-11-09&sr=b&spr=https&se=2026-03-09T19%3A08%3A01Z&rscd=attachment%3B+filename%3Ddog%2B3d%2Bmodel.obj&rsct=application%2Foctet-stream&skoid=96c2d410-5711-43a1-aedd-ab1947aa7ab0&sktid=398a6654-997b-47e9-b12b-9515b896b4de&skt=2026-03-09T18%3A07%3A48Z&ske=2026-03-09T19%3A08%3A01Z&sks=b&skv=2018-11-09&sig=rWqRja4%2FmrA2Uhs9ytgbM8gsfMFGTaBGp87tp5%2BJesE%3D&jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmVsZWFzZS1hc3NldHMuZ2l0aHVidXNlcmNvbnRlbnQuY29tIiwia2V5Ijoia2V5MSIsImV4cCI6MTc3MzA4MjQwMCwibmJmIjoxNzczMDgwNjAwLCJwYXRoIjoicmVsZWFzZWFzc2V0cHJvZHVjdGlvbi5ibG9iLmNvcmUud2luZG93cy5uZXQifQ.6PnC8h3qRyzeMrsFmdztsA4dl3EXuvgHSHboi5Ed4IA&response-content-disposition=attachment%3B%20filename%3Ddog%2B3d%2Bmodel.obj&response-content-type=application%2Foctet-stream';

https.get(url, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
});
