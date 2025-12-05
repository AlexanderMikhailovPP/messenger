import { useEffect, useRef } from 'react';

const SpoilerText = ({ children, revealed, onClick }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = containerRef.current.getBoundingClientRect();

    const scale = 2;
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    ctx.scale(scale, scale);

    const particleCount = Math.floor((rect.width * rect.height) / 20);

    particlesRef.current = [];
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        size: Math.random() * 1 + 0.5,
        speedX: (Math.random() - 0.5) * 0.6,
        speedY: (Math.random() - 0.5) * 0.6,
        opacity: Math.random() * 0.4 + 0.6,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (!revealed) {
        particlesRef.current.forEach(particle => {
          particle.x += particle.speedX;
          particle.y += particle.speedY;

          if (particle.x < 0) particle.x = rect.width;
          if (particle.x > rect.width) particle.x = 0;
          if (particle.y < 0) particle.y = rect.height;
          if (particle.y > rect.height) particle.y = 0;

          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
          ctx.fill();
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [revealed]);

  return (
    <span
      ref={containerRef}
      onClick={onClick}
      className="relative inline-block cursor-pointer select-none"
    >
      <span
        className="transition-opacity duration-500"
        style={{ opacity: revealed ? 1 : 0 }}
      >
        {children}
      </span>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{ opacity: revealed ? 0 : 1, width: '100%', height: '100%' }}
      />
    </span>
  );
};

export default SpoilerText;
