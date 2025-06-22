// Analysis Dashboard Notification System
class AnalysisNotifications {
    constructor() {
        this.container = this.createContainer();
        this.notifications = [];
        this.soundEnabled = AnalysisConfig.notifications.sound;
    }
    
    createContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }
    
    show(message, type = 'info', duration = null) {
        const toast = this.createToast(message, type);
        this.container.appendChild(toast);
        this.notifications.push(toast);
        
        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        // Auto remove
        const autoRemoveTime = duration || AnalysisConfig.notifications.duration;
        setTimeout(() => {
            this.remove(toast);
        }, autoRemoveTime);
        
        // Play sound if enabled
        if (this.soundEnabled && type !== 'info') {
            this.playNotificationSound(type);
        }
        
        return toast;
    }
    
    createToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = this.getIcon(type);
        
        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        // Click to dismiss
        toast.addEventListener('click', () => {
            this.remove(toast);
        });
        
        return toast;
    }
    
    getIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle',
            whale: 'whale'
        };
        return icons[type] || 'info-circle';
    }
    
    remove(toast) {
        if (!toast.parentNode) return;
        
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                this.container.removeChild(toast);
            }
            const index = this.notifications.indexOf(toast);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 300);
    }
    
    clear() {
        this.notifications.forEach(toast => {
            this.remove(toast);
        });
    }
    
    playNotificationSound(type) {
        if (!this.soundEnabled) return;
        
        try {
            // Create audio context
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Different frequencies for different notification types
            const frequencies = {
                success: [523.25, 659.25, 783.99], // C5, E5, G5
                error: [220, 220, 220], // A3 repeated
                warning: [440, 554.37], // A4, C#5
                whale: [261.63, 329.63, 392.00, 523.25] // C4, E4, G4, C5
            };
            
            const freq = frequencies[type] || frequencies.info;
            this.playBeepSequence(audioContext, freq);
        } catch (e) {
            console.warn('Audio notification failed:', e);
        }
    }
    
    playBeepSequence(audioContext, frequencies) {
        frequencies.forEach((freq, index) => {
            setTimeout(() => {
                this.playBeep(audioContext, freq, 0.2);
            }, index * 150);
        });
    }
    
    playBeep(audioContext, frequency, duration) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    }
    
    // Convenience methods
    success(message, duration) {
        return this.show(message, 'success', duration);
    }
    
    error(message, duration) {
        return this.show(message, 'error', duration);
    }
    
    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }
    
    info(message, duration) {
        return this.show(message, 'info', duration);
    }
    
    whale(message, duration) {
        return this.show(message, 'whale', duration);
    }
    
    // Settings
    enableSound() {
        this.soundEnabled = true;
    }
    
    disableSound() {
        this.soundEnabled = false;
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        return this.soundEnabled;
    }
}

// Create global instance
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalysisNotifications;
} else {
    window.AnalysisNotifications = AnalysisNotifications;
    
    // Auto-initialize
    document.addEventListener('DOMContentLoaded', () => {
        window.notifications = new AnalysisNotifications();
    });
} 