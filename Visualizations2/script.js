const dataPath = '../data/iris.data';
const features = ['sepal length', 'sepal width', 'petal length', 'petal width'];
const speciesColors = {
	setosa: '#cf593e',
	versicolor: '#378c85',
	virginica: '#5c65a8'
};
const svg = d3.select('#radar-chart');
const legend = document.querySelector('#legend');
const dataStatus = document.querySelector('#data-status');
const chartTooltip = document.querySelector('#chart-tooltip');
const errorMessage = document.querySelector('#error-message');
let summaries = [];
const visibleSpecies = new Set();

// RADAR / DATA: parse CSV rows into numeric measurements and species labels.
function parseData(text) {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const values = line.split(',').map((value) => value.trim());
			return {
				values: values.slice(0, 4).map(Number),
				species: values[4].replace('Iris-', '').toLowerCase()
			};
		})
		.filter((row) => row.values.every(Number.isFinite) && row.species);
}

// RADAR / SUMMARY: calculate the four average measurements for each species.
function summarize(rows) {
	const groups = d3.group(rows, (row) => row.species);
	return [...groups].map(([species, values]) => ({
		species,
		values: features.map((_, featureIndex) => d3.mean(values, (row) => row.values[featureIndex]))
	}));
}

// RADAR / SCALE DOMAIN: find each feature's min/max among species averages.
function getRanges() {
	return features.map((_, featureIndex) => ({
		min: d3.min(summaries, (summary) => summary.values[featureIndex]),
		max: d3.max(summaries, (summary) => summary.values[featureIndex])
	}));
}

// RADAR / DRAW: set SVG scales, angle, center, and convert values to points.
function drawRadar() {
	const chartWrap = document.querySelector('.chart-wrap');
	const width = Math.min(720, Math.max(320, chartWrap.clientWidth));
	const height = Math.min(620, Math.max(420, width * 0.82));
	const margin = { top: 78, right: 76, bottom: 58, left: 76 };
	const radius = Math.min((width - margin.left - margin.right) / 2, (height - margin.top - margin.bottom) / 2);
	const center = { x: width / 2, y: height / 2 + 12 };
	const startAngle = (3 * Math.PI) / 2;
	const angleScale = d3.scaleLinear().domain([0, features.length]).range([startAngle, startAngle + Math.PI * 2]);
	const radiusScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);
	const ranges = getRanges();
	const point = (index, value) => {
		const angle = angleScale(index) - Math.PI / 2;
		return [
			center.x + Math.cos(angle) * radiusScale(value),
			center.y + Math.sin(angle) * radiusScale(value)
		];
	};
	const normalized = (value, range) => 0.18 + ((value - range.min) / (range.max - range.min || 1)) * 0.82;
	const radarLine = d3.line().curve(d3.curveLinearClosed);

	svg.attr('viewBox', `0 0 ${width} ${height}`)
		.attr('width', width)
		.attr('height', height);
	svg.selectAll('*').remove();

	// RADAR / GRID: bind four levels and draw the nested polygon rings.
	const grid = svg.append('g').attr('class', 'grid');
	grid.selectAll('polygon')
		.data([0.25, 0.5, 0.75, 1])
		.join('polygon')
		.attr('points', (level) => features.map((_, index) => point(index, level)).join(' '))
		.attr('class', 'grid-ring');

	// RADAR / AXES: draw the feature axes, labels, and numeric ticks.
	const axes = svg.append('g').attr('class', 'axes');
	axes.selectAll('line')
		.data(features)
		.join('line')
		.attr('x1', center.x)
		.attr('y1', center.y)
		.attr('x2', (_, index) => point(index, 1)[0])
		.attr('y2', (_, index) => point(index, 1)[1])
		.attr('class', 'axis-line');

	axes.selectAll('.axis-label')
		.data(features)
		.join('text')
		.attr('class', 'axis-label')
		.attr('x', (_, index) => point(index, 1.16)[0])
		.attr('y', (_, index) => point(index, 1.16)[1])
		.attr('text-anchor', (_, index) => index === 1 ? 'start' : index === 3 ? 'end' : 'middle')
		.text((feature) => feature);

	grid.selectAll('.tick-label')
		.data([0.25, 0.5, 0.75, 1])
		.join('text')
		.attr('class', 'tick-label')
		.attr('x', center.x + 6)
		.attr('y', (value) => center.y - radiusScale(value))
		.text((value) => value.toFixed(2));

	// RADAR / SPECIES SHAPES: bind each visible species summary to an SVG path.
	const speciesGroup = svg.append('g').attr('class', 'species-layer');
	speciesGroup.selectAll('.species')
		.data(summaries.filter((summary) => visibleSpecies.has(summary.species)), (summary) => summary.species)
		.join('path')
		.attr('class', 'species')
		.attr('d', (summary) => radarLine(summary.values.map((value, index) => point(index, normalized(value, ranges[index])))) )
		.attr('fill', (summary) => speciesColors[summary.species])
		.attr('fill-opacity', 0.22)
		.attr('stroke', (summary) => speciesColors[summary.species])
		.attr('stroke-width', 2.5)
		.attr('stroke-linejoin', 'round')
		.attr('stroke-linecap', 'round')
		.on('mousemove', function (event, summary) {
			chartTooltip.hidden = false;
			chartTooltip.textContent = `${summary.species} average profile`;
			chartTooltip.style.left = `${event.offsetX + 12}px`;
			chartTooltip.style.top = `${event.offsetY + 12}px`;
		})
		.on('mouseleave', () => {
			chartTooltip.hidden = true;
		});

	dataStatus.textContent = `Loaded ${summaries.length} species averages from 150 rows`;
}

// RADAR / INTERACTION: toggle species paths when legend buttons are clicked.
function renderLegend() {
	legend.innerHTML = summaries.map((summary) => `
		<button class="legend-item${visibleSpecies.has(summary.species) ? ' is-visible' : ''}" data-species="${summary.species}" type="button" aria-pressed="${visibleSpecies.has(summary.species)}">
			<span class="legend-dot" style="background:${speciesColors[summary.species]}"></span>
			${summary.species}
		</button>
	`).join('');
	legend.querySelectorAll('.legend-item').forEach((button) => {
		button.addEventListener('click', () => {
			const species = button.dataset.species;
			if (visibleSpecies.has(species)) visibleSpecies.delete(species);
			else visibleSpecies.add(species);
			renderLegend();
			drawRadar();
		});
	});
}

function showError(error) {
	console.error(`Unable to render ${dataPath}`, error);
	dataStatus.textContent = 'Data loading failed';
	errorMessage.textContent = `${error.message}. Please open the page through a local server.`;
	errorMessage.hidden = false;
}

async function init() {
	try {
		const response = await fetch(dataPath);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const rows = parseData(await response.text());
		if (!rows.length) throw new Error('No usable records found in the data file');
		summaries = summarize(rows);
		summaries.forEach((summary) => visibleSpecies.add(summary.species));
		renderLegend();
		drawRadar();
	} catch (error) {
		showError(error);
	}
}

window.addEventListener('resize', drawRadar);
init();
