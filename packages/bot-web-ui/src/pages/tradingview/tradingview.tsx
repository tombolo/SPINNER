import React from 'react';
import styles from './tradingview.module.scss';

const Tradingview: React.FC = () => {
    return (
        <div className={styles.container}>
            <iframe
                src="https://charts.deriv.com/deriv"
                title="AiPage"
                className={styles.iframe}
                loading="lazy"
            />
        </div>
    );
};

export default Tradingview;
