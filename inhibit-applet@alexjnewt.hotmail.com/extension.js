'use strict';

const { GObject, St, Gio } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Updated schema and keys based on your system
const POWER_SCHEMA = 'org.gnome.settings-daemon.plugins.power';
const POWER_AC_KEY = 'sleep-inactive-ac-type';
const POWER_BATTERY_KEY = 'sleep-inactive-battery-type';
const SCREEN_SCHEMA = 'org.gnome.desktop.screensaver';
const SCREEN_KEY = 'idle-activation-enabled';

// Icons
const DisabledIcon = 'preferences-desktop-screensaver-symbolic';
const EnabledIcon = 'system-run-symbolic';

const TOOLTIPON = "Presentation Mode: ON";
const TOOLTIPOFF = "Presentation Mode: OFF";

let inhibitButton;

const InhibitButton = GObject.registerClass(
class InhibitButton extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Inhibit Applet');
        
        this._icon = new St.Icon({
            icon_name: DisabledIcon,
            style_class: 'system-status-icon',
        });
        
        this.add_child(this._icon);
        this.tooltip_text = TOOLTIPOFF;
        
        // Settings
        this._powerSettings = new Gio.Settings({ schema: POWER_SCHEMA });
        this._screenSettings = new Gio.Settings({ schema: SCREEN_SCHEMA });
        
        // Store original values to restore later
        this._originalAcType = this._powerSettings.get_string(POWER_AC_KEY);
        this._originalBatteryType = this._powerSettings.get_string(POWER_BATTERY_KEY);
        this._originalScreensaverState = this._screenSettings.get_boolean(SCREEN_KEY);
        
        // Check if we're already in presentation mode
        this._isPresentationMode = false;
        this._checkInitialState();
        
        // Connect click handler
        this.connect('button-press-event', this._toggleState.bind(this));
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
        
        if (this._isPresentationMode) {
            // Enable presentation mode
            this._powerSettings.set_string(POWER_AC_KEY, 'nothing');
            this._powerSettings.set_string(POWER_BATTERY_KEY, 'nothing');
            this._screenSettings.set_boolean(SCREEN_KEY, false);
        } else {
            // Disable presentation mode
            this._powerSettings.set_string(POWER_AC_KEY, this._originalAcType);
            this._powerSettings.set_string(POWER_BATTERY_KEY, this._originalBatteryType);
            this._screenSettings.set_boolean(SCREEN_KEY, this._originalScreensaverState);
        }
        
        this._updateUI();
    }
    
    _updateUI() {
        if (this._isPresentationMode) {
            this.tooltip_text = TOOLTIPON;
            this._icon.icon_name = EnabledIcon;
        } else {
            this.tooltip_text = TOOLTIPOFF;
            this._icon.icon_name = DisabledIcon;
        }
    }
    
    destroy() {
        // Restore settings to original values
        if (this._powerSettings && this._isPresentationMode) {
            this._powerSettings.set_string(POWER_AC_KEY, this._originalAcType);
            this._powerSettings.set_string(POWER_BATTERY_KEY, this._originalBatteryType);
            this._screenSettings.set_boolean(SCREEN_KEY, this._originalScreensaverState);
        }
        
        super.destroy();
    }
});

// Standard extension hooks
function init() {
    ExtensionUtils.initTranslations();
}

function enable() {
    inhibitButton = new InhibitButton();
    Main.panel.addToStatusArea('inhibit-applet', inhibitButton);
}

function disable() {
    if (inhibitButton) {
        inhibitButton.destroy();
        inhibitButton = null;
    }
}
