!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.SimpleJSLib=t():e.SimpleJSLib=t()}("undefined"!=typeof window?window:"undefined"!=typeof globalThis?globalThis:this,(function(){return(()=>{"use strict";var e={d:(t,o)=>{for(var n in o)e.o(o,n)&&!e.o(t,n)&&Object.defineProperty(t,n,{enumerable:!0,get:o[n]})},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t)},t={};e.d(t,{default:()=>n});class o{static add(e,t){return e+t}static subtract(e,t){return e-t}}const n=class{static sayHello(){console.log("Hello!")}static doMath(){console.log("3 + 2 - 7 = ???");const e=o.add(3,2),t=o.subtract(e,7);return console.log("The answer is:",t),t}};return t.default})()}));