'use strict';

import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// Schemas and keys
const POWER_SCHEMA = 'org.gnome.settings-daemon.plugins.power';
const POWER_AC_KEY = 'sleep-inactive-ac-type';
const POWER_BATTERY_KEY = 'sleep-inactive-battery-type';
const SCREEN_SCHEMA = 'org.gnome.desktop.screensaver';
const SCREEN_KEY = 'idle-activation-enabled';
const SESSION_SCHEMA = 'org.gnome.desktop.session';
const SESSION_IDLE_KEY = 'idle-delay';
const DISPLAY_AC_KEY = 'idle-dim';

// Icons
const DisabledIcon = 'preferences-desktop-screensaver-symbolic';
const EnabledIcon = 'display-projector-symbolic';

// Menu labels
const MENU_TOGGLE_LABEL_ON = "Disable Presentation Mode";
const MENU_TOGGLE_LABEL_OFF = "Enable Presentation Mode";
const MENU_STATUS_LABEL_ON = "Presentation Mode: On";
const MENU_STATUS_LABEL_OFF = "Presentation Mode: Off";

const InhibitButton = GObject.registerClass(
class InhibitButton extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Presentation Mode Panel');
        
        this._icon = new St.Icon({
            icon_name: DisabledIcon,
            style_class: 'system-status-icon',
        });
        
        this.add_child(this._icon);
        
        // Settings
        this._powerSettings = new Gio.Settings({ schema: POWER_SCHEMA });
        this._screenSettings = new Gio.Settings({ schema: SCREEN_SCHEMA });
        this._sessionSettings = new Gio.Settings({ schema: SESSION_SCHEMA });
        
        // Check if we're already in presentation mode
        this._isPresentationMode = false;
        this._checkInitialState();
        
        // Create menu
        this._createMenu();
    }
    
    _createMenu() {
        // Status label
        this._statusItem = new PopupMenu.PopupMenuItem(
            this._isPresentationMode ? MENU_STATUS_LABEL_ON : MENU_STATUS_LABEL_OFF,
            { reactive: false }
        );
        this.menu.addMenuItem(this._statusItem);
        
        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Toggle switch
        this._toggleItem = new PopupMenu.PopupMenuItem(
            this._isPresentationMode ? MENU_TOGGLE_LABEL_ON : MENU_TOGGLE_LABEL_OFF
        );
        this._toggleItem.connect('activate', this._toggleState.bind(this));
        this.menu.addMenuItem(this._toggleItem);
    }
    
    _checkInitialState() {
        // If both power settings are 'nothing' and screensaver is disabled,
        // we're already in presentation mode
        const acType = this._powerSettings.get_string(POWER_AC_KEY);
        const batteryType = this._powerSettings.get_string(POWER_BATTERY_KEY);
        const screensaverEnabled = this._screenSettings.get_boolean(SCREEN_KEY);
        
        if (acType === 'nothing' && batteryType === 'nothing' && !screensaverEnabled) {
            this._isPresentationMode = true;
            this._updateUI();
        }
    }
    
    _toggleState() {
        this._isPresentationMode = !this._isPresentationMode;
        
        try {
            if (this._isPresentationMode) {
                // Store current settings
                this._originalAcType = this._powerSettings.get_string(POWER_AC_KEY);
                this._originalBatteryType = this._powerSettings.get_string(POWER_BATTERY_KEY);
                this._originalScreensaverState = this._screenSettings.get_boolean(SCREEN_KEY);
                this._originalIdleDelay = this._sessionSettings.get_uint(SESSION_IDLE_KEY);
                this._originalIdleDim = this._powerSettings.get_boolean(DISPLAY_AC_KEY);
                
                console.log('pres-mode-panel: Stored original settings');
                
                // Apply new settings
                this._powerSettings.set_string(POWER_AC_KEY, 'nothing');
                this._powerSettings.set_string(POWER_BATTERY_KEY, 'nothing');
                this._screenSettings.set_boolean(SCREEN_KEY, false);
                this._sessionSettings.set_uint(SESSION_IDLE_KEY, 0);
                this._powerSettings.set_boolean(DISPLAY_AC_KEY, false);
                
                console.log('pres-mode-panel: Applied presentation mode settings');
            } else {
                // Restore settings
                this._powerSettings.set_string(POWER_AC_KEY, this._originalAcType);
                this._powerSettings.set_string(POWER_BATTERY_KEY, this._originalBatteryType);
                this._screenSettings.set_boolean(SCREEN_KEY, this._originalScreensaverState);
                this._sessionSettings.set_uint(SESSION_IDLE_KEY, this._originalIdleDelay);
                this._powerSettings.set_boolean(DISPLAY_AC_KEY, this._originalIdleDim);
                
                console.log('pres-mode-panel: Restored original settings');
            }
            
            // Update UI immediately
            this._updateUI();
        } catch (e) {
            console.error('pres-mode-panel: Error in toggleState', e);
        }
    }    
    
    
    _updateUI() {
        // Update icon
        this._icon.icon_name = this._isPresentationMode ? EnabledIcon : DisabledIcon;
        
        // Update menu items if they exist
        if (this._statusItem) {
            this._statusItem.label.text = this._isPresentationMode ? 
                MENU_STATUS_LABEL_ON : MENU_STATUS_LABEL_OFF;
        }
        
        if (this._toggleItem) {
            this._toggleItem.label.text = this._isPresentationMode ? 
                MENU_TOGGLE_LABEL_ON : MENU_TOGGLE_LABEL_OFF;
        }
    }
    
    destroy() {
        // Restore settings to original values if presentation mode is active
        if (this._powerSettings && this._isPresentationMode && 
            this._originalAcType !== null && this._originalBatteryType !== null) {
            this._powerSettings.set_string(POWER_AC_KEY, this._originalAcType);
            this._powerSettings.set_string(POWER_BATTERY_KEY, this._originalBatteryType);
            this._screenSettings.set_boolean(SCREEN_KEY, this._originalScreensaverState);
            this._sessionSettings.set_uint(SESSION_IDLE_KEY, this._originalIdleDelay);
            this._powerSettings.set_boolean(DISPLAY_AC_KEY, this._originalIdleDim);
        }
        
        super.destroy();
    }
});

export default class PresentationModeExtension extends Extension {
    enable() {
        this._inhibitButton = new InhibitButton();
        Main.panel.addToStatusArea('presentation-mode-panel', this._inhibitButton);
    }

    disable() {
        if (this._inhibitButton) {
            this._inhibitButton.destroy();
            this._inhibitButton = null;
        }
    }
}
