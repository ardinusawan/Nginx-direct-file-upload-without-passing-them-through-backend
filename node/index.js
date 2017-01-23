var express = require('express');
var app = express(); //

app.post('/', function(req, res) {
  console.log(req.headers);
  console.log('\n\n');
  res.send(req.headers);
});

app.get('/index.html', function(req, res) {
  res.send("blah blah index.html");
});

app.listen(8080, "127.0.0.1");
console.log('Server running at http://127.0.0.1:8080/');
