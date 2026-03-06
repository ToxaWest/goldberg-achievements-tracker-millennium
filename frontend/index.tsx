import { definePlugin, IconsModule } from '@steambrew/client';
import React from 'react';

const SettingsContent = () => {
    return React.createElement('div', { style: { padding: '20px', color: 'white' } }, 
        React.createElement('h3', null, 'GSE Achievements Tracker'),
        React.createElement('p', null, 'Plugin is active.')
    );
};

export default definePlugin(() => {
    console.log('GSE Achievements: Injected.');

    return {
        title: "GSE Achievements",
        icon: React.createElement(IconsModule.Settings, null),
        content: React.createElement(SettingsContent, null),
    };
});
