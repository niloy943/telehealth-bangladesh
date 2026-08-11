import React, { useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

const isCursorDisabled = () => document.documentElement.dataset.cursorDisabled === 'true';

export const CustomCursor = () => {
  const [hoverType, setHoverType] = useState('default'); // 'default', 'button', 'input', 'card', 'upload'
  const [visible, setVisible] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [isMagnetic, setIsMagnetic] = useState(false);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
  const checkDisabled = () => {
      const isDisabled = isCursorDisabled();
      setDisabled(isDisabled);
      if (isDisabled) {
        document.documentElement.classList.remove('custom-cursor-active');
        setVisible(false);
        setClicked(false);
        setIsMagnetic(false);
        particles.current = [];
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        if (activeTiltedCard.current) {
          activeTiltedCard.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
          activeTiltedCard.current = null;
        }
      } else {
        if (visible) {
          document.documentElement.classList.add('custom-cursor-active');
        }
      }
    };
    checkDisabled();
    const observer = new MutationObserver(checkDisabled);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-cursor-disabled'] });
    return () => observer.disconnect();
  }, [visible]);

  const canvasRef = useRef(null);
  const particles = useRef([]);
  const requestRef = useRef(null);
  const lastMousePos = useRef({ x: -100, y: -100 });
  const mouseVelocity = useRef({ x: 0, y: 0 });
  const activeTiltedCard = useRef(null);

  // Springs for smooth tracking
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  const springConfig = { damping: 32, stiffness: 280, mass: 0.5 };
  const trailX = useSpring(cursorX, springConfig);
  const trailY = useSpring(cursorY, springConfig);

  // Outer ring size and stretch
  const ringScaleX = useSpring(1, { damping: 20, stiffness: 200 });
  const ringScaleY = useSpring(1, { damping: 20, stiffness: 200 });
  const ringRotate = useSpring(0, { damping: 20, stiffness: 200 });

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (isCursorDisabled()) return;
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update particles and mouse velocity in animation frame loop
  useEffect(() => {
    const updatePhysics = () => {
      if (disabled || isCursorDisabled()) {
        particles.current = [];
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        requestRef.current = requestAnimationFrame(updatePhysics);
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) {
        requestRef.current = requestAnimationFrame(updatePhysics);
        return;
      }
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Spawning upload-specific passive particles when hovering upload zone
      if (hoverType === 'upload' && visible) {
        // Spawn particles rising up from cursor area
        if (Math.random() < 0.4) {
          particles.current.push({
            x: lastMousePos.current.x + (Math.random() - 0.5) * 40,
            y: lastMousePos.current.y + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1.5 - Math.random() * 2,
            size: Math.random() * 5 + 3,
            alpha: 0.8,
            color: 'rgba(217, 119, 6, 0.6)', // Amber-600
            life: 45
          });
        }
      }

      // 2. Update and draw particles
      particles.current = particles.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 1.2 / p.life; // Fade based on life
        p.size *= 0.96; // Shrink
        p.life -= 1;

        if (p.life <= 0 || p.alpha <= 0) return false;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.size * 2;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.restore();
        return true;
      });

      // 3. Apply velocity-based stretch to the ring
      const vx = mouseVelocity.current.x;
      const vy = mouseVelocity.current.y;
      const speed = Math.sqrt(vx * vx + vy * vy);

      if (speed > 1 && !isMagnetic) {
        const angle = Math.atan2(vy, vx) * (180 / Math.PI);
        const stretchAmount = Math.min(speed / 45, 0.7); // scale up on X
        const shrinkAmount = Math.min(speed / 80, 0.35); // shrink slightly on Y

        ringScaleX.set(1 + stretchAmount);
        ringScaleY.set(1 - shrinkAmount);
        ringRotate.set(angle);
      } else {
        ringScaleX.set(1);
        ringScaleY.set(1);
        ringRotate.set(0);
      }

      // Decay velocity slowly
      mouseVelocity.current.x *= 0.85;
      mouseVelocity.current.y *= 0.85;

      requestRef.current = requestAnimationFrame(updatePhysics);
    };

    requestRef.current = requestAnimationFrame(updatePhysics);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [hoverType, visible, isMagnetic, ringScaleX, ringScaleY, ringRotate, disabled]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (disabled || isCursorDisabled()) {
        document.documentElement.classList.remove('custom-cursor-active');
        return;
      }
      const clientX = e.clientX;
      const clientY = e.clientY;

      // Calculate velocity
      const dx = clientX - lastMousePos.current.x;
      const dy = clientY - lastMousePos.current.y;
      mouseVelocity.current.x = dx;
      mouseVelocity.current.y = dy;

      lastMousePos.current.x = clientX;
      lastMousePos.current.y = clientY;

      if (!visible) setVisible(true);

      const target = e.target;
      if (!target || !target.closest) return;

      // Handle spotlight elements (updates relative position for lighting)
      const spotlightCard = target.closest('.spotlight-card');
      if (spotlightCard) {
        const rect = spotlightCard.getBoundingClientRect();
        spotlightCard.style.setProperty('--mouse-x', `${clientX - rect.left}px`);
        spotlightCard.style.setProperty('--mouse-y', `${clientY - rect.top}px`);
      }

      // Handle 3D Card tilting globally
      const tiltCard = target.closest('.tilt-card');
      if (tiltCard) {
        if (activeTiltedCard.current && activeTiltedCard.current !== tiltCard) {
          activeTiltedCard.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        }
        activeTiltedCard.current = tiltCard;
        const rect = tiltCard.getBoundingClientRect();
        const cardX = clientX - rect.left;
        const cardY = clientY - rect.top;
        const rotateY = ((cardX / rect.width) - 0.5) * 12; // Max 12 degrees
        const rotateX = (0.5 - (cardY / rect.height)) * 12;
        tiltCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      } else if (activeTiltedCard.current) {
        // Reset previous card rotation
        activeTiltedCard.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        activeTiltedCard.current = null;
      }

      // Detect magnetic attraction
      const magneticTarget = target.closest('.magnetic-target, button, .theme-toggle-btn, .sidebar-nav-item');
      if (magneticTarget) {
        setIsMagnetic(true);
        const rect = magneticTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Move outer ring to center of magnetic target
        cursorX.set(clientX);
        cursorY.set(clientY);
        trailX.set(centerX);
        trailY.set(centerY);

        setHoverType('button');
      } else {
        setIsMagnetic(false);
        cursorX.set(clientX);
        cursorY.set(clientY);

        // Update hover states
        if (target.closest('input') || target.closest('textarea') || target.closest('select')) {
          setHoverType('input');
        } else if (target.closest('.glass-panel') || target.closest('.interactive-card') || target.closest('.spotlight-card')) {
          setHoverType('card');
        } else if (target.closest('.upload-zone') || target.closest('[type="file"]')) {
          setHoverType('upload');
        } else {
          setHoverType('default');
        }
      }

      // Add particles for the cursor trail
      const speed = Math.sqrt(dx * dx + dy * dy);
      if (speed > 1.5 && particles.current.length < 80) {
        let pColor = 'rgba(20, 184, 166, 0.4)'; // Teal
        if (hoverType === 'button') pColor = 'rgba(99, 102, 241, 0.5)'; // Indigo
        else if (hoverType === 'upload') pColor = 'rgba(245, 158, 11, 0.5)'; // Amber
        else if (hoverType === 'card') pColor = 'rgba(6, 182, 212, 0.4)'; // Cyan

        particles.current.push({
          x: clientX,
          y: clientY,
          vx: -dx * 0.12 + (Math.random() - 0.5) * 1.5,
          vy: -dy * 0.12 + (Math.random() - 0.5) * 1.5,
          size: Math.random() * 4 + 2.5,
          alpha: 0.7,
          color: pColor,
          life: 30 + Math.random() * 20
        });
      }
    };

    const handleMouseLeave = () => {
      if (disabled || isCursorDisabled()) return;
      setVisible(false);
      if (activeTiltedCard.current) {
        activeTiltedCard.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        activeTiltedCard.current = null;
      }
    };

    const handleMouseEnter = () => {
      if (!disabled && !isCursorDisabled()) setVisible(true);
    };

    const handleMouseDown = () => {
      if (disabled || isCursorDisabled()) return;
      setClicked(true);
      // Particle burst on click
      const currentX = lastMousePos.current.x;
      const currentY = lastMousePos.current.y;
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        particles.current.push({
          x: currentX,
          y: currentY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 5 + 3,
          alpha: 0.9,
          color: 'rgba(99, 102, 241, 0.8)', // Violet burst
          life: 35 + Math.random() * 15
        });
      }
    };

    const handleMouseUp = () => {
      if (!disabled && !isCursorDisabled()) setClicked(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    if (!disabled && !isCursorDisabled()) {
      document.documentElement.classList.add('custom-cursor-active');
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.documentElement.classList.remove('custom-cursor-active');
      if (activeTiltedCard.current) {
        activeTiltedCard.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      }
    };
  }, [cursorX, cursorY, visible, hoverType, isMagnetic, trailX, trailY, disabled]);

  if (!visible || disabled) return null;

  // Render sizing and color config based on active state
  let ringSize = 28;
  let ringColor = 'rgba(20, 184, 166, 0.5)'; // Teal-400
  let ringBorderWidth = 1.5;
  let dotScale = 1;

  if (hoverType === 'button') {
    ringSize = 48;
    ringColor = 'rgba(99, 102, 241, 0.6)'; // Indigo-500
    ringBorderWidth = 2;
    dotScale = 0.4;
  } else if (hoverType === 'input') {
    ringSize = 12;
    ringColor = 'rgba(6, 182, 212, 0.8)'; // Cyan focus
    ringBorderWidth = 1.2;
    dotScale = 1.6;
  } else if (hoverType === 'card') {
    ringSize = 40;
    ringColor = 'rgba(99, 102, 241, 0.35)'; // Indigo soft spotlight halo
    ringBorderWidth = 1;
    dotScale = 1.1;
  } else if (hoverType === 'upload') {
    ringSize = 58;
    ringColor = 'rgba(245, 158, 11, 0.6)'; // Amber-500 pulsing ring
    ringBorderWidth = 2;
    dotScale = 0.7;
  }

  if (clicked) {
    ringSize = ringSize * 0.65;
    dotScale = 1.8;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden hidden md:block">
      {/* Background canvas for fluid particles */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-[9998]"
      />

      {/* Trailing Outer Ring with Velocity Stretch and Magnetic Snapping */}
      <motion.div
        style={{
          x: trailX,
          y: trailY,
          translateX: '-50%',
          translateY: '-50%',
          scaleX: ringScaleX,
          scaleY: ringScaleY,
          rotate: ringRotate,
        }}
        animate={{
          width: ringSize,
          height: ringSize,
          borderColor: ringColor,
          borderWidth: ringBorderWidth,
          boxShadow: isMagnetic 
            ? '0 0 16px rgba(99, 102, 241, 0.4)' 
            : hoverType === 'upload' 
              ? '0 0 12px rgba(245, 158, 11, 0.3)' 
              : '0 0 8px rgba(20, 184, 166, 0.1)',
        }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="absolute rounded-full border border-solid pointer-events-none z-[9999]"
      />

      {/* Main Center Dot (Stays directly under the cursor for precision pointer response) */}
      <motion.div
        style={{
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          scale: dotScale,
          backgroundColor: hoverType === 'button' 
            ? 'var(--color-primary)' 
            : hoverType === 'upload' 
              ? 'var(--color-warning)' 
              : 'var(--color-secondary)',
          boxShadow: hoverType === 'input' 
            ? '0 0 6px var(--color-secondary)' 
            : '0 1px 2px rgba(0, 0, 0, 0.1)',
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 450 }}
        className="absolute w-2 h-2 rounded-full pointer-events-none z-[9999]"
      />

      {/* Extra clicking ripple waves */}
      {clicked && (
        <motion.div
          initial={{ x: cursorX.get(), y: cursorY.get(), scale: 0.1, opacity: 0.8 }}
          animate={{ scale: 3.5, opacity: 0 }}
          style={{
            translateX: '-50%',
            translateY: '-50%',
          }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="absolute w-8 h-8 rounded-full border border-solid border-indigo-400 pointer-events-none z-[9999]"
        />
      )}
    </div>
  );
};
