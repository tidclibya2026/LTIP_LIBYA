import {useEffect} from 'react';
import {useMap} from 'react-leaflet';
import {attachBasemap} from './basemap.js';
export default function Basemap({fitCountry=false,context=null}){
 const map=useMap();
 useEffect(()=>attachBasemap(map,{fitCountry,countryData:context}),[map,fitCountry,context]);
 return null;
}
