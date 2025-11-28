import React from 'react';
import styles from './finesttool.module.scss'; // assuming you renamed it correctly

const Finesttool = () => {
    return (
        <div className={styles.container}>
            <iframe
                src="https://kiongozi-ten.vercel.app/"
                title="Finest Analysis"
                className={styles.iframe}
                allowFullScreen
            />
        </div>
    );
};

export default Finesttool;
