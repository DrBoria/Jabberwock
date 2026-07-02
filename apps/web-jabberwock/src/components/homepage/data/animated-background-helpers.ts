export type GradientPoint = { x: number; y: number; radius: number; color: string }

export class Particle {
	x: number
	y: number
	size: number
	speedX: number
	speedY: number
	color: string
	opacity: number

	constructor(canvas: HTMLCanvasElement) {
		this.x = Math.random() * canvas.width
		this.y = Math.random() * (canvas.height * 0.7)
		this.size = Math.random() * 2 + 1
		this.speedX = (Math.random() - 0.5) * 0.8
		this.speedY = (Math.random() - 0.5) * 0.8
		this.color = "rgba(100, 150, 255, "
		this.opacity = Math.random() * 0.5 + 0.2
	}

	update(canvas: HTMLCanvasElement) {
		this.x += this.speedX
		this.y += this.speedY

		if (this.x > canvas.width) this.x = 0
		else if (this.x < 0) this.x = canvas.width
		if (this.y > canvas.height * 0.7) this.y = 0
		else if (this.y < 0) this.y = canvas.height * 0.7

		this.opacity += Math.sin(Date.now() * 0.001) * 0.01
		this.opacity = Math.max(0.1, Math.min(0.7, this.opacity))
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = `${this.color}${this.opacity})`
		ctx.beginPath()
		ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
		ctx.fill()
	}
}

export function drawGrid(
	ctx: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	gradientPoints: GradientPoint[],
	particles: Particle[],
	gridSize: number,
	gridOpacity: number,
) {
	ctx.clearRect(0, 0, canvas.width, canvas.height)

	gradientPoints.forEach((point) => {
		const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, point.radius)
		gradient.addColorStop(0, point.color)
		gradient.addColorStop(1, "rgba(0, 0, 0, 0)")

		ctx.fillStyle = gradient
		ctx.fillRect(0, 0, canvas.width, canvas.height)
	})

	ctx.strokeStyle = `rgba(50, 50, 70, ${gridOpacity})`
	ctx.lineWidth = 0.5

	const horizonY = canvas.height * 0.7
	const vanishingPointX = canvas.width * 0.5

	for (let x = 0; x <= canvas.width; x += gridSize) {
		const normalizedX = x / canvas.width - 0.5

		ctx.beginPath()
		ctx.moveTo(x, 0)

		const curveStrength = 50 * Math.abs(normalizedX)
		const controlPointY = horizonY - curveStrength

		ctx.quadraticCurveTo(
			x + (vanishingPointX - x) * 0.3,
			controlPointY,
			vanishingPointX + (x - vanishingPointX) * 0.2,
			horizonY,
		)

		ctx.stroke()
	}

	for (let y = 0; y <= horizonY; y += gridSize) {
		const normalizedY = y / horizonY
		const lineWidth = gridSize * (1 + normalizedY * 5)

		ctx.beginPath()
		ctx.moveTo(vanishingPointX - lineWidth, y)
		ctx.lineTo(vanishingPointX + lineWidth, y)
		ctx.stroke()
	}

	updateAndDrawParticles(ctx, particles)
}

export function connectParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
	const maxDistance = 150

	for (let a = 0; a < particles.length; a++) {
		for (let b = a; b < particles.length; b++) {
			const pA = particles[a]
			const pB = particles[b]
			if (!pA || !pB) continue

			const dx = pA.x - pB.x
			const dy = pA.y - pB.y
			const distance = Math.sqrt(dx * dx + dy * dy)

			if (distance < maxDistance) {
				const opacity = (1 - distance / maxDistance) * 0.5
				ctx.strokeStyle = `rgba(100, 150, 255, ${opacity})`
				ctx.lineWidth = 0.5
				ctx.beginPath()
				ctx.moveTo(pA.x, pA.y)
				ctx.lineTo(pB.x, pB.y)
				ctx.stroke()
			}
		}
	}
}

function updateAndDrawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
	particles.forEach((particle) => {
		particle.update(ctx.canvas)
		particle.draw(ctx)
	})

	connectParticles(ctx, particles)
}

export function updateGradientPosition(
	canvas: HTMLCanvasElement,
	gradientPoints: GradientPoint[],
	targetX: number,
	targetY: number,
	moveSpeed: number,
) {
	const point = gradientPoints[0]!
	const dx = targetX - point.x
	const dy = targetY - point.y

	point.x += dx * moveSpeed
	point.y += dy * moveSpeed

	const distanceToTarget = Math.sqrt(dx * dx + dy * dy)
	point.radius = Math.max(
		canvas.width * 0.2,
		Math.min(canvas.width * 0.4, canvas.width * 0.3 + distanceToTarget * 0.1),
	)
}
