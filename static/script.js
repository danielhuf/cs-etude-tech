document.addEventListener('DOMContentLoaded', function() {
    setupCheckbox();
    setupSlider([0, 5], 0, 5);
    setupDates();
    setupEventListeners();
    fetchCities().then(() => {
        setupDefaults();
        fetchFlights(); 
    });
});

function setupCheckbox() {
    var allCheckbox = document.querySelector('.all');
    var checkboxes = document.querySelectorAll('.stay-duration:not(.all)');

    allCheckbox.addEventListener('change', function() {
        for (var i = 0; i < checkboxes.length; i++) {
            checkboxes[i].checked = this.checked;  
        }
    });

    checkboxes.forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
            if (!this.checked) {
                allCheckbox.checked = false;
            } else {
                var allChecked = true;
                for (var i = 0; i < checkboxes.length; i++) {
                    if (!checkboxes[i].checked) {
                        allChecked = false;
                        break;
                    }
                }
                allCheckbox.checked = allChecked;
            }
        });
    });
}

function setupSlider(startValues, min, max) {
    var sliderElement = document.getElementById('nb-connections-slider');
    noUiSlider.create(sliderElement, {
        start: startValues,
        connect: true,
        range: {
            'min': min,
            'max': max
        },
        step: 1,
        pips: {
            mode: 'values',
            values: [0, 1, 2, 3, 4, 5],
            density: 100
        },
        format: {
            to: function(value) {
                return parseInt(value);
            },
            from: function(value) {
                return parseInt(value);
            }
        }
    });

    sliderElement.noUiSlider.on('update', function(values, handle) {
        sliderElement.dataset.min = values[0];
        sliderElement.dataset.max = values[1];
    });
}

function setupDates() {
    var departureDateInput = document.getElementById('departure-date');
    var today = new Date().toISOString().split('T')[0];
    departureDateInput.setAttribute('max', today); 
    departureDateInput.value = today; 
}

function setupEventListeners() {
    document.getElementById('search-flights').addEventListener('click', function() {
        fetchFlights();
    });
}

async function fetchCities() {
    try {
        const response = await fetch('http://localhost:5000/api/cities');
        const data = await response.json();
        populateDatalist('origin-options', data.origins);
        populateDatalist('destination-options', data.destinations);
    } catch (error) {
        console.error('Error fetching city data:', error);
    }
}

function populateDatalist(datalistId, options) {
    const datalist = document.getElementById(datalistId);
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        datalist.appendChild(optionElement);
    });
}

function setupDefaults() {
    const originInput = document.getElementById('origin-city');
    const destinationInput = document.getElementById('destination-city');
    if (originInput && destinationInput) {
        originInput.value = 'PAR'; // Default origin
        destinationInput.value = 'LIS'; // Default destination
    }
}

function fetchFlights() {
    const originCity = document.getElementById('origin-city').value;
    const destinationCity = document.getElementById('destination-city').value;
    let tripType = document.getElementById('trip-type').value;
    tripType = tripType === 'One way' ? 'OW' : 'RT';

    const nbConnectionsSlider = document.getElementById('nb-connections-slider');
    const nbConnectionsMin = nbConnectionsSlider.dataset.min;
    const nbConnectionsMax = nbConnectionsSlider.dataset.max;

    const url = new URL('http://localhost:5000/api/flights');
    url.searchParams.append('origin', originCity);
    url.searchParams.append('destination', destinationCity);
    url.searchParams.append('trip_type', tripType);
    url.searchParams.append('nb_connections_min', nbConnectionsMin);
    url.searchParams.append('nb_connections_max', nbConnectionsMax);

    fetch(url)
        .then(response => response.json())
        .then(data => {
            updateDataContainer(data);
        })
        .catch(error => {
            console.error('Error fetching flights:', error);
        });
}

function updateDataContainer(flights) {
    const container = document.getElementById('data-container');
    container.innerHTML = ''; 
    flights.forEach(flight => {
        const div = document.createElement('div');
        div.innerHTML = `Median price: ${flight.median_price}, Advance purchase: ${flight.adv_purchase}, Main airline: ${flight.main_airline}, Ond: ${flight.ond}`;
        container.appendChild(div);
    });
}
