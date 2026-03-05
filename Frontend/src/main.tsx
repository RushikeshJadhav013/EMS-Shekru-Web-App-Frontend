import React from 'react';
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";


console.log("main.tsx: about to render");
const root = document.getElementById("root");
console.log("main.tsx: root element:", root);
createRoot(root!).render(<App />);
console.log("main.tsx: render called");
