const columns = ['sepal length', 'sepal width', 'petal length', 'petal width'];
const dataPath = '../data/iris.data';
const canvas = document.querySelector('#correlation-canvas');
const canvasContext = canvas.getContext('2d');
const heatmapTooltip = document.querySelector('#heatmap-tooltip');
const rowCount = document.querySelector('#row-count');
const speciesCount = document.querySelector('#species-count');
const dataStatus = document.querySelector('#data-status');
const speciesControls = document.querySelector('#species-controls');
const errorMessage = document.querySelector('#error-message');
let dataRows = [];
let activeSpecies = 'all';

// HEATMAP / DATA: parse each CSV line into four measurements and a species label.
function parseCsv(text) {
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

// HEATMAP / FILTER: create species buttons and redraw after selection changes.
function initControls() {
	const species = ['all', ...new Set(dataRows.map((row) => row.species))];
	speciesControls.innerHTML = species.map((value) => `
		<button class="species-button${value === activeSpecies ? ' is-active' : ''}" data-species="${value}" aria-pressed="${value === activeSpecies}" type="button">
			${value === 'all' ? 'all species' : value}
		</button>
	`).join('');
	speciesControls.querySelectorAll('button').forEach((button) => {
		button.addEventListener('click', () => {
			activeSpecies = button.dataset.species;
			speciesControls.querySelectorAll('button').forEach((control) => {
				const isActive = control === button;
				control.classList.toggle('is-active', isActive);
				control.setAttribute('aria-pressed', isActive);
			});
		renderHeatmap(getVisibleRows());
		});
	});
}

function getVisibleRows() {
	return activeSpecies === 'all'
		? dataRows
		: dataRows.filter((row) => row.species === activeSpecies);
}

// HEATMAP / CORRELATION: calculate Pearson's r for two measurement columns.
function pearson(first, second) {
	const firstMean = first.reduce((sum, value) => sum + value, 0) / first.length;
	const secondMean = second.reduce((sum, value) => sum + value, 0) / second.length;
	let numerator = 0;
	let firstSquare = 0;
	let secondSquare = 0;

	first.forEach((value, index) => {
		const firstDelta = value - firstMean;
		const secondDelta = second[index] - secondMean;
		numerator += firstDelta * secondDelta;
		firstSquare += firstDelta ** 2;
		secondSquare += secondDelta ** 2;
	});

	return numerator / Math.sqrt(firstSquare * secondSquare) || 0;
}

// HEATMAP / MATRIX: calculate pairwise correlations for all measurement columns.
function correlationMatrix(rows) {
	const valueColumns = columns.map((_, columnIndex) => rows.map((row) => row.values[columnIndex]));
	return valueColumns.map((firstColumn) =>
		valueColumns.map((secondColumn) => pearson(firstColumn, secondColumn))
	);
}

// HEATMAP / COLOR: map correlation strength to a green shade.
function correlationColor(value) {
	const intensity = Math.abs(value);
	const lightness = 94 - intensity * 48;
	const saturation = 42 + intensity * 18;
	// GREEN SQUARE COLOR: this hue controls the heatmap cell color.
	return `hsl(145 ${saturation}% ${lightness}%)`;
}

// HEATMAP / DRAW: render the labels and upper-triangle cells on Canvas.
function renderHeatmap(rows) {
	const matrix = correlationMatrix(rows);
	const cellSize = 92;
	const labelSize = 116;
	const canvasSize = labelSize + cellSize * columns.length;
	const pixelRatio = window.devicePixelRatio || 1;
	canvas.width = canvasSize * pixelRatio;
	canvas.height = canvasSize * pixelRatio;
	canvas.style.width = `${canvasSize}px`;
	canvas.style.height = `${canvasSize}px`;
	canvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	canvasContext.clearRect(0, 0, canvasSize, canvasSize);
	canvasContext.font = '12px Arial, sans-serif';
	canvasContext.textBaseline = 'middle';

	columns.forEach((column, index) => {
		const position = labelSize + index * cellSize + cellSize / 2;
		canvasContext.fillStyle = '#52615e';
		canvasContext.textAlign = 'center';
		canvasContext.fillText(column, position, 20);
		canvasContext.save();
		canvasContext.translate(18, labelSize + index * cellSize + cellSize / 2);
		canvasContext.rotate(-Math.PI / 2);
		canvasContext.fillText(column, 0, 0);
		canvasContext.restore();
	});

	matrix.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
		// TRIANGLE SHAPE: skip the lower-left half; keep the diagonal and upper-right cells.
		if (rowIndex > columnIndex) return;

		const x = labelSize + columnIndex * cellSize;
		const y = labelSize + rowIndex * cellSize;
		canvasContext.fillStyle = correlationColor(value);
		// Draw each heatmap cell as a green square.
		canvasContext.fillRect(x, y, cellSize - 3, cellSize - 3);
		canvasContext.fillStyle = Math.abs(value) > 0.58 ? '#fff' : '#17232b';
		canvasContext.textAlign = 'center';
		canvasContext.fillText(value.toFixed(2), x + (cellSize - 3) / 2, y + (cellSize - 3) / 2);
	}));

	dataStatus.textContent = `Loaded ${dataRows.length} rows; using ${rows.length} rows for correlation`;
}

// HEATMAP / TOOLTIP: show the correlation value for the hovered visible cell.
function showTooltip(event) {
	const rectangle = canvas.getBoundingClientRect();
	const cellSize = 92;
	const labelSize = 116;
	const columnIndex = Math.floor((event.clientX - rectangle.left - labelSize) / cellSize);
	const rowIndex = Math.floor((event.clientY - rectangle.top - labelSize) / cellSize);
	const rows = getVisibleRows();
	const matrix = correlationMatrix(rows);

	// Match the drawing rule: the blank lower-left half has no tooltip.
	if (rowIndex < 0 || rowIndex >= columns.length || columnIndex < 0 || columnIndex >= columns.length || rowIndex > columnIndex) {
		heatmapTooltip.hidden = true;
		return;
	}

	heatmapTooltip.hidden = false;
	heatmapTooltip.textContent = `${columns[rowIndex]} vs ${columns[columnIndex]}: ${matrix[rowIndex][columnIndex].toFixed(3)}`;
	heatmapTooltip.style.left = `${event.clientX - rectangle.left + 12}px`;
	heatmapTooltip.style.top = `${event.clientY - rectangle.top + 12}px`;
}

// HEATMAP / LOAD: fetch the Iris file, initialize controls, and draw the chart.
async function loadData() {
	const response = await fetch(dataPath);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	dataRows = parseCsv(await response.text());
	if (!dataRows.length) throw new Error('No usable records found in the data file');
	rowCount.textContent = dataRows.length;
	speciesCount.textContent = new Set(dataRows.map((row) => row.species)).size;
	initControls();
	renderHeatmap(getVisibleRows());
}

canvas.addEventListener('mousemove', showTooltip);
canvas.addEventListener('mouseleave', () => {
	heatmapTooltip.hidden = true;
});
function showError(error) {
	console.error(`Unable to render ${dataPath}`, error);
	dataStatus.textContent = 'Data loading failed';
	errorMessage.textContent = `${error.message}. Please open the page through a local server.`;
	errorMessage.hidden = false;
}

async function init() {
	try {
		await loadData();
	} catch (error) {
		showError(error);
	}
}

init();
