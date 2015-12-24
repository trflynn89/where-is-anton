import math

from django.http import HttpResponse
from django.http import HttpResponseBadRequest
from django.shortcuts import render_to_response
from django.utils import timezone
from django.views.generic import View

from models import Drunks

class Drunk(View):

    def get(self, request, *args, **kwargs):
        last = Drunks.GetLastDrunk()

        isDrunk = last.drunk if last else False
        hours = 0

        if last:
            diff = timezone.now() - last.time
            hours = diff.total_seconds() / 60 / 60
            hours = int(math.ceil(hours))

        if isDrunk and (hours > 14):
            Drunks(
                drunk=False
            ).put()

            isDrunk = False
            hours = 0

        return render_to_response('drunk.html',
            {
                'drunk': isDrunk,
                'hours': hours
            });

    def post(self, request, *args, **kwargs):
        isDrunk = request.POST.get('drunk')

        if not isDrunk:
            return HttpResponseBadRequest()

        isDrunk = (isDrunk == 1) or (isDrunk == '1')
        drunk = Drunks.GetLastDrunk()

        if drunk:
            if drunk.drunk and isDrunk:
                return HttpResponseBadRequest()
            if not drunk.drunk and not isDrunk:
                return HttpResponseBadRequest()

        Drunks(
            drunk=isDrunk
        ).put()

        return HttpResponse()
