"use client"

import { useEffect, useRef } from "react"
import { Particle, drawGrid, updateGradientPosition, type GradientPoint } from "../data/animated-background-helpers"

export function AnimatedBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext("2d")
		if (!ctx) return

		const gridSize = 50
		const gridOpacity = 0.15

		let gradientPoints: GradientPoint[] = [
			{
				x: canvas.width * 0.2,
				y: canvas.height * 0.3,
				radius: canvas.width * 0.4,
				color: "rgba(0, 100, 255, 0.15)",
			},
			{
				x: canvas.width * 0.8,
				y: canvas.height * 0.7,
				radius: canvas.width * 0.5,
				color: "rgba(100, 0, 255, 0.1)",
			},
		]

		const particles: Particle[] = []
		const particleCount = Math.min(50, Math.floor(window.innerWidth / 40))

		const resizeCanvas = () => {
			canvas.width = window.innerWidth
			canvas.height = window.innerHeight

			gradientPoints = [
				{
					x: canvas.width * 0.2,
					y: canvas.height * 0.3,
					radius: canvas.width * 0.4,
					color: "rgba(0, 100, 255, 0.15)",
				},
				{
					x: canvas.width * 0.8,
					y: canvas.height * 0.7,
					radius: canvas.width * 0.5,
					color: "rgba(100, 0, 255, 0.1)",
				},
			]

			drawGrid(ctx, canvas, gradientPoints, particles, gridSize, gridOpacity)
		}

		resizeCanvas()
		window.addEventListener("resize", resizeCanvas)

		for (let i = 0; i < particleCount; i++) {
			particles.push(new Particle(canvas))
		}

		let animationId: number

		let targetX = canvas.width * 0.2
		let targetY = canvas.height * 0.3
		const moveSpeed = 0.05

		const handleMouseMove = (e: MouseEvent) => {
			targetX = e.clientX
			targetY = e.clientY
		}

		function animate() {
			animationId = requestAnimationFrame(animate)
			updateGradientPosition(canvas!, gradientPoints, targetX, targetY, moveSpeed)
			drawGrid(ctx!, canvas!, gradientPoints, particles, gridSize, gridOpacity)
		}

		animate()

		window.addEventListener("mousemove", handleMouseMove)

		return () => {
			window.removeEventListener("resize", resizeCanvas)
			window.removeEventListener("mousemove", handleMouseMove)
			cancelAnimationFrame(animationId)
		}
	}, [])

	return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ zIndex: 0 }} />
}
