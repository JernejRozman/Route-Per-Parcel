const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const port  = 8080;
const urlencodedParser = bodyParser.urlencoded({extended:true}); 

function main() {
  app.use('/', express.static('public'));
  app.use(urlencodedParser);
  app.use(express.json());

app.post('/request-route', (req, res) => {    
    // Prepare request for Routes Preferred API
    const requestBody = {
        ...req.body,
        travelMode: "DRIVE",  // Optimization only supports DRIVE mode
        optimizeWaypointOrder: req.body.intermediates?.length > 0,
        routingPreference: "TRAFFIC_AWARE"
    };

    // Use Routes Preferred API endpoint
    fetch("https://routespreferred.googleapis.com/v1alpha:computeRoutes", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": "AIzaSyAhdLxHNUHsRQUGFa_UkPFT4qo6O-Ub0ek",
            "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs",
            "X-Server-Timeout": "15"  // Podaljšan čas za timeout, da ima več časa za mlet
        },
        body: JSON.stringify(req.body)
    }).then((response) => {
        return response.json();
    }).then((data) => {
        if ('error' in data) {
            console.log(data.error);
            res.status(500).json(data.error);
        } else if (!data.routes || data.routes.length === 0) {
            console.log("No route found");
            res.status(404).send("No route found");
        } else {
            res.json(data);
        }
    }).catch((error) => {
        console.log(error);
        res.status(500).send(error.message);
    });
});

  app.listen(port, () => {
      console.log('App listening on port ${port}: ' + port);
      console.log('Press Ctrl+C to quit.');
  });
}

main();