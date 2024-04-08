document.addEventListener('DOMContentLoaded', function() {
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

    var nbConnectionsSlider = document.getElementById('nb-connections-slider');
    setupSlider(nbConnectionsSlider, [0, 4], 0, 4);

    var departureDateInput = document.getElementById('departure-date');
    var today = new Date().toISOString().split('T')[0];
    departureDateInput.setAttribute('max', today); 
    departureDateInput.value = today; 

    fetchAndDisplayData();
});

function setupSlider(sliderElement, startValues, min, max) {
    noUiSlider.create(sliderElement, {
        start: startValues,
        connect: true,
        range: {
            'min': min,
            'max': max
        },
        step: 1,
        format: {
            to: function(value) {
                return value.toFixed(0);
            },
            from: function(value) {
                return Number(value).toFixed(0);
            }
        }
    });

    sliderElement.noUiSlider.on('update', function(values, handle) {
        console.log('Slider values:', values);
    });
}

function fetchAndDisplayData() {
    fetch('http://localhost:5000/api/flights')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('data-container');
            data.forEach(flight => {
                const div = document.createElement('div');
                div.innerHTML = `Median price: ${flight.median_price}, Advance purchase: ${flight.adv_purchase}, Main airline: ${flight.main_airline}, Ond: ${flight.ond}`;
                container.appendChild(div);
            });
        })
        .catch(error => {
            console.error('Error fetching data', error);
        });
}
