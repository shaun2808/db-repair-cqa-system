import React from 'react';
import './NavBar.css';
import wrenchIcon from '../../images/wrench.png';

function NavBar() {
  React.useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  return (
    <nav className="navbar">
      <span className="navbar-icon" aria-label="Wrench Icon" title="CQA Repair Tool">
        <img src={wrenchIcon} alt="Wrench Icon" style={{height: '2rem', width: '2rem'}} />
      </span>
      <h1 className="navbar-title">Data Repair Tool</h1>
    </nav>
  );
}

export default NavBar;
