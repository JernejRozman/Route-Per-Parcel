const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const port  = 8080;
const urlencodedParser = bodyParser.urlencoded({extended:true}); 

function main() {
  app.use('/', express.static('public'));
  app.use(urlencodedParser);
  app.use(express.json());

  app.post('/request-route', (req,res) => {    
    fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": "#######################################",
        "X-Goog-FieldMask": "*"
      },
      body: JSON.stringify(req.body)
    }).then((response) => {
      return response.json();
    }).then((data) => {
      if('error' in data){
        console.log(data.error);
      } else if(!data.hasOwnProperty("routes")){
        console.log("No route round");
      } else {
        res.end(JSON.stringify(data));
      }
    }).catch((error) => {
      console.log(error)
    });
  });

  app.listen(port, () => {
      console.log('App listening on port ${port}: ' + port);
      console.log('Press Ctrl+C to quit.');
  });
}

main();