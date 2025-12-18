import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl'

// TODO: Replace with your Mapbox access token
mapboxgl.accessToken = "YOUR_MAPBOX_ACCESS_TOKEN";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [0, 0],
  zoom: 1,
});

map.on("load", () => {
  console.log("Map is ready");
  // Add your demo code here
});
