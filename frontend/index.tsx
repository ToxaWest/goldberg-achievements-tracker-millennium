import { definePlugin } from '@steambrew/client';
import React from 'react';

export default definePlugin(() => {
    console.log("GSE Achievements: Minimal load test.");

    return {
        title: "GSE Achievements",
        icon: <div />, 
        content: <div style={{padding: '20px', color: 'white'}}>GSE Achievements: Minimal Settings Page</div>,
    };
});
