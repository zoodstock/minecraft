// Input handler - keyboard, mouse, and mobile touch joystick
// Short press = break, long press (300ms+) = place

const LONG_PRESS_TIME = 300; // ms

export class InputHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.state = {
            forward: false, backward: false, left: false, right: false,
            jump: false, sprint: false, descend: false,
            mouseDX: 0, mouseDY: 0,
            leftClick: false, rightClick: false,
            joystickX: 0, joystickY: 0,
            lookJoystickDX: 0, lookJoystickDY: 0,
        };
        this.isLocked = false;
        this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // For long-press detection on mouse
        this._mouseDownTime = 0;
        this._mouseIsDown = false;

        this._initKeyboard();
        this._initMouse();
        if (this.isMobile) {
            this._initJoysticks();
        }
    }

    _initKeyboard() {
        document.addEventListener('keydown', (e) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': this.state.forward = true; break;
                case 'KeyS': case 'ArrowDown': this.state.backward = true; break;
                case 'KeyA': case 'ArrowLeft': this.state.left = true; break;
                case 'KeyD': case 'ArrowRight': this.state.right = true; break;
                case 'Space': this.state.jump = true; e.preventDefault(); break;
                case 'ShiftLeft': case 'ShiftRight':
                    this.state.sprint = true;
                    this.state.descend = true;
                    break;
            }
        });
        document.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': this.state.forward = false; break;
                case 'KeyS': case 'ArrowDown': this.state.backward = false; break;
                case 'KeyA': case 'ArrowLeft': this.state.left = false; break;
                case 'KeyD': case 'ArrowRight': this.state.right = false; break;
                case 'Space': this.state.jump = false; break;
                case 'ShiftLeft': case 'ShiftRight':
                    this.state.sprint = false;
                    this.state.descend = false;
                    break;
            }
        });
    }

    _initMouse() {
        this.canvas.addEventListener('click', () => {
            if (!this.isMobile && !this.isLocked) {
                this.canvas.requestPointerLock();
            }
        });
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.canvas;
        });
        document.addEventListener('mousemove', (e) => {
            if (this.isLocked) {
                this.state.mouseDX += e.movementX;
                this.state.mouseDY += e.movementY;
            }
        });
        // Short press = break (left click), long press = place (right click)
        document.addEventListener('mousedown', (e) => {
            if (!this.isLocked) return;
            if (e.button === 0) {
                this._mouseDownTime = performance.now();
                this._mouseIsDown = true;
            }
            // Right click still works as place
            if (e.button === 2) this.state.rightClick = true;
        });
        document.addEventListener('mouseup', (e) => {
            if (!this.isLocked) return;
            if (e.button === 0 && this._mouseIsDown) {
                const held = performance.now() - this._mouseDownTime;
                if (held < LONG_PRESS_TIME) {
                    this.state.leftClick = true;  // short = break
                } else {
                    this.state.rightClick = true;  // long = place
                }
                this._mouseIsDown = false;
            }
        });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _initJoysticks() {
        this.moveJoystick = this._createJoystick('joystick-move', true);
        this.lookJoystick = this._createJoystick('joystick-look', false);
        this._createActionButtons();
    }

    _createJoystick(id, isLeft) {
        const container = document.getElementById(id);
        if (!container) return null;

        const joystick = {
            container,
            inner: container.querySelector('.joystick-inner'),
            active: false,
            touchId: null,
            startX: 0, startY: 0,
            maxRadius: 50,
        };

        container.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            joystick.active = true;
            joystick.touchId = touch.identifier;
            const rect = container.getBoundingClientRect();
            joystick.startX = rect.left + rect.width / 2;
            joystick.startY = rect.top + rect.height / 2;
            this._updateJoystick(joystick, touch.clientX, touch.clientY, isLeft);
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === joystick.touchId && joystick.active) {
                    e.preventDefault();
                    this._updateJoystick(joystick, touch.clientX, touch.clientY, isLeft);
                }
            }
        }, { passive: false });

        const endTouch = (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === joystick.touchId) {
                    joystick.active = false;
                    joystick.touchId = null;
                    joystick.inner.style.transform = 'translate(-50%, -50%)';
                    if (isLeft) {
                        this.state.joystickX = 0;
                        this.state.joystickY = 0;
                    } else {
                        this.state.lookJoystickDX = 0;
                        this.state.lookJoystickDY = 0;
                    }
                }
            }
        };
        document.addEventListener('touchend', endTouch);
        document.addEventListener('touchcancel', endTouch);

        return joystick;
    }

    _updateJoystick(joystick, touchX, touchY, isLeft) {
        let dx = touchX - joystick.startX;
        let dy = touchY - joystick.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxR = joystick.maxRadius;

        if (dist > maxR) {
            dx = dx / dist * maxR;
            dy = dy / dist * maxR;
        }

        joystick.inner.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        const nx = dx / maxR;
        const ny = dy / maxR;

        if (isLeft) {
            this.state.joystickX = nx;
            this.state.joystickY = ny;
        } else {
            this.state.lookJoystickDX = nx * 4;
            this.state.lookJoystickDY = ny * 4;
        }
    }

    _createActionButtons() {
        const jumpBtn = document.getElementById('btn-jump');
        const breakBtn = document.getElementById('btn-break');
        const placeBtn = document.getElementById('btn-place');
        const descendBtn = document.getElementById('btn-descend');

        if (jumpBtn) {
            jumpBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.state.jump = true;
            }, { passive: false });
            jumpBtn.addEventListener('touchend', () => {
                this.state.jump = false;
            });
        }
        if (descendBtn) {
            descendBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.state.descend = true;
            }, { passive: false });
            descendBtn.addEventListener('touchend', () => {
                this.state.descend = false;
            });
        }
        if (breakBtn) {
            breakBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.state.leftClick = true;
            }, { passive: false });
        }
        if (placeBtn) {
            placeBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.state.rightClick = true;
            }, { passive: false });
        }
    }

    consumeClicks() {
        const lc = this.state.leftClick;
        const rc = this.state.rightClick;
        this.state.leftClick = false;
        this.state.rightClick = false;
        return { leftClick: lc, rightClick: rc };
    }

    consumeMouse() {
        const dx = this.state.mouseDX + this.state.lookJoystickDX;
        const dy = this.state.mouseDY + this.state.lookJoystickDY;
        this.state.mouseDX = 0;
        this.state.mouseDY = 0;
        return { dx, dy };
    }
}
