/**
 * Triggers a confetti explosion effect originating from a specific HTML element.
 * @param {HTMLElement} element - The element from which the confetti should burst.
 */
export function triggerConfetti(element) {
    if (!element || typeof confetti !== 'function') return;

    const rect = element.getBoundingClientRect();
    
    // Don't fire confetti if the element is off-screen
    if (rect.top > window.innerHeight || rect.bottom < 0) return;
    
    const origin = {
        x: (rect.left + rect.right) / 2 / window.innerWidth,
        y: (rect.top + rect.bottom) / 2 / window.innerHeight
    };

    function fire(particleRatio, opts) {
        confetti(Object.assign({}, {
            origin: origin,
            particleCount: Math.floor(200 * particleRatio),
            spread: 90,
            gravity: 0.7,
            scalar: 1.1,
            ticks: 150,
            colors: ['#26a69a', '#ef5350', '#ffc107', '#ffffff', '#2196f3']
        }, opts));
    }

    fire(0.25, { spread: 30, startVelocity: 60 });
    fire(0.2, { spread: 60, startVelocity: 45 });
    fire(0.35, { spread: 120, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 130, startVelocity: 30, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 150, startVelocity: 50 });
} 