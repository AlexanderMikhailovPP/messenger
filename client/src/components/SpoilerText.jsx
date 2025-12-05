import { useState, useEffect, useRef } from 'react';

export default function SpoilerText({ children }) {
    const [revealed, setRevealed] = useState(false);
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const particlesRef = useRef([]);

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = containerRef.current.getBoundingClientRect();

        canvas.width = rect.width;
        canvas.height = rect.height;

        const particleCount = Math.floor((rect.width * rect.height) / 40);

        if (particlesRef.current.length === 0) {
            for (let i = 0; i < particleCount; i++) {
                particlesRef.current.push({
                    x: Math.random() * rect.width,
                    y: Math.random() * rect.height,
                    size: Math.random() * 2 + 1,
                    speedX: (Math.random() - 0.5) * 0.5,
                    speedY: (Math.random() - 0.5) * 0.5,
                    opacity: Math.random() * 0.5 + 0.3,
                });
            }
        }

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (!revealed) {
                particlesRef.current.forEach(particle => {
                    particle.x += particle.speedX;
                    particle.y += particle.speedY;

                    if (particle.x < 0) particle.x = canvas.width;
                    if (particle.x > canvas.width) particle.x = 0;
                    if (particle.y < 0) particle.y = canvas.height;
                    if (particle.y > canvas.height) particle.y = 0;

                    ctx.beginPath();
                    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(140, 140, 160, ${particle.opacity})`;
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

    // Reset particles when canvas size changes
    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            if (containerRef.current && canvasRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                canvasRef.current.width = rect.width;
                canvasRef.current.height = rect.height;

                // Reinitialize particles for new size
                const particleCount = Math.floor((rect.width * rect.height) / 40);
                particlesRef.current = [];
                for (let i = 0; i < particleCount; i++) {
                    particlesRef.current.push({
                        x: Math.random() * rect.width,
                        y: Math.random() * rect.height,
                        size: Math.random() * 2 + 1,
                        speedX: (Math.random() - 0.5) * 0.5,
                        speedY: (Math.random() - 0.5) * 0.5,
                        opacity: Math.random() * 0.5 + 0.3,
                    });
                }
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setRevealed(true);
    };

    return (
        <span
            ref={containerRef}
            onClick={handleClick}
            className="relative inline-block cursor-pointer select-none"
            style={{ minWidth: '20px' }}
        >
            <span
                className="transition-all duration-1000 ease-out"
                style={{
                    filter: revealed ? 'blur(0px)' : 'blur(6px)',
                    opacity: revealed ? 1 : 0.7,
                }}
            >
                {children}
            </span>
            <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
                style={{
                    opacity: revealed ? 0 : 1,
                }}
            />
        </span>
    );
}
