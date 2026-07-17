import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css'; 
import networkImage from './assets/Network.jpeg'; 

export default function LandingPage() {
  return (
    <div className="landing-container">
      <div className="landing-image-wrapper">
        <img src={networkImage} alt="Network Topology" className="landing-image-style"/>
      </div>

    
      <div className="landing-content">
        <h1 className="landing-title">Mininet Arhitect</h1>
        
        <p className="landing-description">
            Create visual networks, translate them into python code ready to be imported in Mininet. This project is meant to facilitate the proess of proiecting 
            visual network, from the designing / visual phase, to the implementation phase.
        </p>
        
        <Link to="/app">
          <button className="button landing-button-large">
            Start
          </button>
        </Link>
      </div>

    </div>
  );
}