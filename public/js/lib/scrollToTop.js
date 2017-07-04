/************************************************************************
*************************************************************************
@Name :       	scrollToTop - jQuery Plugin
@Revison :    	1.0
@Date : 		    01/2014
@Author:     	  minko
@License :		  Open Source - MIT License : http://www.opensource.org/licenses/mit-license.php

**************************************************************************
*************************************************************************/

(function($) {
  $.scrollToTop = {
		defaults: {
			text : '^',
      autoShow: true,
			autoShowOffset: 512,
			scrollSpeed: 500,
      animSpeed: 500,
      animation: true
		},
		init: function(options) {
			opts = $.extend({}, $.scrollToTop.defaults, options);
			var $scrollToTop = $.scrollToTop._constructLink();
			if (opts.autoShow) {
        var displayed = false;
        $(window).scroll(function() {
          if($(this).scrollTop() > opts.autoShowOffset) {
            // show link when scrolling the window
            if (opts.animation && !displayed) {
              $scrollToTop.fadeIn(opts.animSpeed, function() {
                displayed = true;
              });
            } else {
              $scrollToTop.show();
              displayed = true;
            }
          } else if (displayed) {
            // hide it
            displayed = false;
            if (opts.animation) {
              $scrollToTop.stop(true, true).fadeOut(opts.animSpeed);
            } else {
              $scrollToTop.hide();
            }
          }
        });
      }
			// scroll body to 0px on click
      $('#back-to-top').click(function(e) {
				e.preventDefault();
        $('body,html').animate({ scrollTop: 0 }, opts.scrollSpeed);
			});
		},

		_constructLink:function() {
			var $scrollToTop = $('<a />', {
				id : 'back-to-top',
				href : '#',
				html : '<span>' + opts.text + '</span>'
			}).prependTo('body');
      
			if (!opts.autoShow) $scrollToTop.show();
      else $scrollToTop.hide();
      return $scrollToTop;
		}

	};

	// Init method
	scrollToTop = function(options) {
		$.scrollToTop.init(options);
	};

})(jQuery);