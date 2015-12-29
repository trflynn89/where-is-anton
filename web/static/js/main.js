var s_map = null;
var s_markers = [];
var s_paths = [];

var s_showAll = false;
var s_drunkTimeout = 10;

var MILLIS_PER_HOUR = 1000 * 60 * 60;

var GMap = google.maps.Map;
var GPoint = google.maps.Point;
var GMarker = google.maps.Marker;
var GLatLng = google.maps.LatLng;
var GLatLngBounds = google.maps.LatLngBounds;
var GInfoWindow = google.maps.InfoWindow;

$(document).ready(function(event)
{
    s_map = new GMap(document.getElementById('map'),
    {
        disableDefaultUI: true,
        center: new GLatLng(0, 0),
        zoom: 2
    });

    google.maps.event.addListener(s_map, 'zoom_changed', updatePaths);
    getLocations(false);
});

function getLocations(showAll)
{
    s_showAll = showAll;
    getAPI('/locations/', showLocations);
}

function getDrunks()
{
    getAPI('/drunk/', showDrunks);
}

function createDrunk(time, isDrunk)
{
    postAPI('/drunk/',
    {
        time: time,
        drunk: isDrunk
    });
}

function timeComparator(a, b)
{
    if (a['time'] < b['time'])
    {
        return 1;
    }
    else if (a['time'] > b['time'])
    {
        return -1;
    }

    return 0;
}

function showLocations(locations)
{
    if (locations.length == 0)
    {
        return;
    }

    locations.sort(timeComparator);
    clearMap();

    if (s_showAll)
    {
        var bounds = new GLatLngBounds();

        for (var i = 0; i < locations.length; ++i)
        {
            var lat = locations[i]['latitude'];
            var lng = locations[i]['longitude'];
            var adr = locations[i]['address'];

            var latlng = addMarker(lat, lng, adr);
            bounds.extend(latlng);
        }

        s_map.fitBounds(bounds);
        drawPaths();
    }
    else
    {
        var lat = locations[0]['latitude'];
        var lng = locations[0]['longitude'];
        var adr = locations[0]['address'];

        s_map.setCenter(new GLatLng(lat, lng));
        s_map.setZoom(8);

        addMarker(lat, lng, adr);
    }
}

function showDrunks(drunks)
{
    var name = getName();

    if (drunks.length == 0)
    {
        Lobibox.alert('error',
        {
            title: 'Nope!',
            msg: name + ' has never been drunk :('
        });

        return;
    }

    drunks.sort(timeComparator);

    var isDrunk = drunks[0]['drunk'];
    var dTime = new Date(drunks[0]['time']).getTime();
    var cTime = new Date().getTime();

    var hours = Math.ceil((cTime - dTime) / MILLIS_PER_HOUR);

    if (isDrunk && (hours > s_drunkTimeout))
    {
        sTime = dTime + (s_drunkTimeout * MILLIS_PER_HOUR);
        createDrunk(sTime, false);

        hours = Math.ceil((cTime - sTime) / MILLIS_PER_HOUR);
        isDrunk = false;
    }

    var answer = (isDrunk ? 'Yes!' : 'Nope!');
    var status = (isDrunk ? ' drunk ' : ' sober ');
    var units = (hours == 1 ? ' hour' : ' hours');
    var smile = (isDrunk ? ' :)' : ' :(');
    var type = (isDrunk ? 'info' : 'error');

    var msg = name + ' has been' + status + 'for ' + hours + units + smile;

    Lobibox.alert(type,
    {
        title: answer,
        msg: msg
    });
}

function clearMap()
{
    for (var i = 0; i < s_markers.length; ++i)
    {
        s_markers[i].setMap(null);
    }
    for (var i = 0; i < s_paths.length; ++i)
    {
        var marker = s_paths[i].marker;
        marker.setMap(null);
    }

    s_markers = [];
    s_paths = [];
}

function addMarker(lat, lng, label)
{
    var latlng = new GLatLng(lat, lng);

    var marker = new GMarker(
    {
        position: latlng,
        optimized: false,
        zIndex: 1,
        map: s_map
    });

    for (var i = 0; i < s_markers.length; ++i)
    {
        if (s_markers[i].position.equals(latlng))
        {
            marker.setMap(null);
            break;
        }
    }

    labelMarker(marker, label);
    s_markers.push(marker);

    return latlng;
}

function labelMarker(marker, message)
{
    var map = marker.getMap();

    if ((map !== null) && (message !== undefined))
    {
        var infowindow = new GInfoWindow(
        {
            content: message
        });

        infowindow.open(marker.getMap(), marker);

        marker.addListener('click', function()
        {
            infowindow.open(marker.getMap(), marker);
        });
    }
}

function drawPaths()
{
    for (var i = 1; i < s_markers.length; ++i)
    {
        s_paths.push(
        {
            start: s_markers[i - 1].getPosition(),
            end: s_markers[i].getPosition(),
            curvature: rand(-0.5, 0.5),
            marker: new GMarker(
            {
                clickable: false,
                optimized: false,
                zIndex: 0,
                map: s_map
            })
        });
    }

    updatePaths();
}

function updatePaths()
{
    var zoom = s_map.getZoom();

    for (var i = 0; i < s_paths.length; ++i)
    {
        var path = s_paths[i];

        path.marker.setOptions(
        {
            position: path.start,
            icon:
            {
                path: calcPath(path),
                scale: (1 / (Math.pow(2, -zoom))),
                strokeColor: '#993333',
                strokeWeight: 2
            }
        });
    }
}

function calcPath(path)
{
    var projection = s_map.getProjection();

    var p1 = projection.fromLatLngToPoint(path.start);
    var p2 = projection.fromLatLngToPoint(path.end);

    // Quadratic Bezier curve
    var e = new GPoint(p2.x - p1.x, p2.y - p1.y);
    var m = new GPoint(e.x / 2, e.y / 2);
    var o = new GPoint(e.y, -e.x);
    var c = new GPoint(m.x + path.curvature * o.x, m.y + path.curvature * o.y);

    return ('M 0,0 q' + ' ' + c.x + ',' + c.y + ' ' + e.x + ',' + e.y);
}

function getAPI(uri, onResponse)
{
    setLoadStatus(true);

    $.get(uri, function(data)
    {
        if (typeof onResponse !== 'undefined')
        {
            onResponse(data.data);
        }

        setLoadStatus(false);
    });
}

function postAPI(uri, data, onResponse)
{
    $.post(uri, data, function(data)
    {
        if (typeof onResponse !== 'undefined')
        {
            onResponse(data);
        }
    });
}

function setLoadStatus(loading)
{
    if (loading)
    {
        $('.hamburger').children().addClass('loading');
    }
    else
    {
        $('.hamburger').children().removeClass('loading');
    }
}

function rand(min, max)
{
    return (Math.random() * (max - min) + min);
}
