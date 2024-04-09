let searchDateRange;
let departureDateRange;

document.addEventListener('DOMContentLoaded', function() {
    setupCheckbox();
    setupSlider([0, 5], 0, 5);
    setupDatePickers();
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

function setupDatePickers() {
    const twoYearsAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 2));
    const today = new Date();

    searchDateRange = { start: twoYearsAgo, end: today };
    departureDateRange = { start: twoYearsAgo, end: today };

    searchDateRange.fpInstance = flatpickr("#search-date", {
        mode: "range",
        dateFormat: "Y-m-d",
        maxDate: today,
        defaultDate: [twoYearsAgo, today],
        onChange: function(selectedDates, dateStr, instance) {
            searchDateRange.start = selectedDates[0];
            searchDateRange.end = selectedDates[1];
        }
    });

    departureDateRange.fpInstance = flatpickr("#departure-date", {
        mode: "range",
        dateFormat: "Y-m-d",
        maxDate: today,
        defaultDate: [twoYearsAgo, today],
        onChange: function(selectedDates, dateStr, instance) {
            departureDateRange.start = selectedDates[0];
            departureDateRange.end = selectedDates[1];
        }
    });
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
        originInput.value = 'PAR'; 
        destinationInput.value = 'LIS';
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

    const isOneAdult = document.getElementById('is-one-adt').value;
    const cabin = document.getElementById('cabin').value;

    const url = new URL('http://localhost:5000/api/flights');
    url.searchParams.append('origin', originCity);
    url.searchParams.append('destination', destinationCity);
    url.searchParams.append('trip_type', tripType);
    url.searchParams.append('nb_connections_min', nbConnectionsMin);
    url.searchParams.append('nb_connections_max', nbConnectionsMax);
    url.searchParams.append('is_one_adult', isOneAdult);
    url.searchParams.append('cabin', cabin);

    if (searchDateRange.start && searchDateRange.end) {
        url.searchParams.append('search_date_start', formatDateToISO(searchDateRange.start));
        url.searchParams.append('search_date_end', formatDateToISO(searchDateRange.end));
    } else {
        const twoYearsAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 2));
        const today = new Date();
        url.searchParams.append('search_date_start', twoYearsAgo.toISOString().split('T')[0]);
        url.searchParams.append('search_date_end', today.toISOString().split('T')[0]);
    }

    if (departureDateRange.start && departureDateRange.end) {
        url.searchParams.append('departure_date_start', formatDateToISO(departureDateRange.start));
        url.searchParams.append('departure_date_end', formatDateToISO(departureDateRange.end));
    } else {
        const twoYearsAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 2));
        const today = new Date();
        url.searchParams.append('departure_date_start', twoYearsAgo.toISOString().split('T')[0]);
        url.searchParams.append('departure_date_end', today.toISOString().split('T')[0]);
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            updateDataContainer(data);
        })
        .catch(error => {
            console.error('Error fetching flights:', error);
        });
}

function formatDateToISO(date) {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
        .toISOString()
        .split("T")[0];
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
