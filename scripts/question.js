H5P.Question = (function ($, EventDispatcher, JoubelUI) {

  /**
   * Extending this class make it alot easier to create tasks for other
   * content types.
   *
   * @class H5P.Question
   * @extends H5P.EventDispatcher
   * @param {string} type
   */
  function Question(type) {
    var self = this;

    // Inheritance
    EventDispatcher.call(this);

    // Register default order
    self.order = ['image', 'introduction', 'content', 'feedback', 'buttons'];

    // Keep track of registered sections
    var sections = {};

    // Buttons
    var buttons = {};
    var buttonOrder = [];

    // Wrapper when attached
    var $wrapper;

    // ScoreBar
    var scoreBar;

    // Keep track of the feedback's visual status. A must for animations.
    var showFeedback;

    // Keep track of which buttons are scheduled for hiding.
    var buttonsToHide = [];

    // Keep track of which buttons are scheduled for showing.
    var buttonsToShow = [];

    // Keep track of the hiding and showing of buttons.
    var toggleButtonsTimer;

    /**
     * Register section with given content.
     *
     * @private
     * @param {string} section ID of the section
     * @param {(string|H5P.jQuery)} content
     */
    var register = function (section, content) {
      var $e = sections[section] = $('<div/>', {
        'class': 'h5p-question-' + section,
      });
      if (content) {
        $e[content instanceof $ ? 'append' : 'html'](content);
      }
    };

    /**
     * Update registered section with content.
     *
     * @private
     * @param {string} section ID of the section
     * @param {(string|H5P.jQuery)} content
     */
    var update = function (section, content) {
      if (content instanceof $) {
        sections[section].html('').append(content);
      }
      else {
        sections[section].html(content);
      }
    };

    /**
     * Insert element with given the ID into the DOM.
     *
     * @private
     * @param {array} order
     * List with ordered element IDs
     * @param {string} id
     * ID of the element to be inserted
     * @param {Object} elements
     * Maps ID to the elements
     * @param {H5P.jQuery} $container
     * Parent container of the elements
     */
    var insert = function (order, id, elements, $container) {
      // Try to find an element id should be after
      for (var i = 0; i < order.length; i++) {
        if (order[i] === id) {
          // Found our pos
          while (i > 0 && !elements[order[i - 1]].is(':visible')) {
            i--;
          }
          if (i === 0) {
            // We are on top.
            elements[id].prependTo($container);
          }
          else {
            // Add after element
            elements[id].insertAfter(elements[order[i - 1]]);
          }
          break;
        }
      }
    };

    /**
     * Set element max height, used for animations
     * @param {H5P.jQuery} $element
     */
    var setElementHeight = function ($element) {
      if (!$element.is(':visible')) {
        // No animation
        $element.css('max-height', 'none');
        return;
      }

      // Get natural element height
      var $tmp = $element.clone()
        .css({
          'position': 'absolute',
          'max-height': 'none'
        }).appendTo($element.parent());

      // Apply height to element
      $element.css('max-height', $tmp.height());
      $tmp.remove();
    };

    /**
     * Does the actual job of hiding the buttons scheduled for hiding.
     *
     * @private
     */
    var hideButtons = function () {
      for (var i = 0; i < buttonsToHide.length; i++) {
        // Using detach() vs hide() makes it harder to cheat.
        buttons[buttonsToHide[i]].detach();
      }
      buttonsToHide = [];
    };

    /**
     * Shows the buttons on the next tick. This is to avoid buttons flickering
     * If they're both added and removed on the same tick.
     *
     * @private
     */
    var toggleButtons = function () {
      // Show buttons
      for (var i = 0; i < buttonsToShow.length; i++) {
        insert(buttonOrder, buttonsToShow[i], buttons, sections.buttons);
      }
      buttonsToShow = [];

      // Hide buttons
      for (var j = 0; j < buttonsToHide.length; j++) {
        if (buttons[buttonsToHide[j]].is(':focus')) {
          // Move focus to the first visible button.
          self.focusButton();
        }
      }

      if (sections.buttons && buttonsToHide.length === sections.buttons.children().length) {
        // All buttons are going to be hidden. Hide container using transition.
        sections.buttons.removeClass('h5p-question-visible');
        sections.buttons.css('max-height', 0);

        // Detach after transition
        setTimeout(function () {
          // Avoiding Transition.onTransitionEnd since it will register multiple events, and there's no way to cancel it if the transition changes back to "show" while the animation is happening.
          hideButtons();
        }, 150);
      }
      else {
        hideButtons();

        // Show button section
        if (!sections.buttons.is(':empty')) {
          sections.buttons.addClass('h5p-question-visible');
          setElementHeight(sections.buttons);
        }
      }

      toggleButtonsTimer = undefined;
    };

    /**
     * Allows for scaling of the question image.
     *
     * @param {H5P.jQuery} $img
     */
    var scaleImage = function ($img) {
      if (!sections.image.hasClass('h5p-question-image-large')) {
        // Find our target height
        var $tmp = $img.clone()
          .css('max-height', 'none').appendTo($img.parent());
        var targetHeight = $tmp.height();
        $tmp.remove();

        // Animate
        setTimeout(function () {
          $img.css('maxHeight', targetHeight);
          sections.image.addClass('h5p-question-image-large');
        }, 0);
        thumb = false;
      }
      else {
        sections.image.removeClass('h5p-question-image-large');
        $img.css('maxHeight', '');
        thumb = true;
      }
    };

    /**
     * Add task image.
     *
     * @param {string} path Relative
     * @param {string} [alt] Text representation
     */
    self.setImage = function (path, alt) {
      // Image container
      sections.image = $('<div/>', {
        'class': 'h5p-question-image',
      });

      // Inner wrap
      var $imgWrap = $('<div/>', {
        'class': 'h5p-question-image-wrap',
        appendTo: sections.image
      });

      // Image element
      var $img = $('<img/>', {
        src: H5P.getPath(path, this.contentId),
        alt: (alt === undefined ? '' : alt),
        on: {
          load: function () {
            // Determine max size
            $img.css('maxHeight', 'none');
            // var maxWidth = this.width;
            var maxHeight = this.height;

            // Determine thumb size
            $img.css('maxHeight', '');
            if (maxHeight > this.height) {
              // We can do better. Add resize capability
              $img.attr('role', 'button').attr('tabIndex', '0');
              $imgWrap.addClass('h5p-question-image-scalable')
                .on('click', function (event) {
                  if (event.which === 1) {
                    scaleImage($img); // Left mouse button click
                  }
                }).on('keypress', function (event) {
                  if (event.which === 32) {
                    scaleImage($img); // Space bar pressed
                  }
                });
            }

            self.trigger('imageLoaded', this);
          }
        },
        appendTo: $imgWrap
      });
    };

    /**
     * Add the introduction section.
     *
     * @param {(string|H5P.jQuery)} content
     */
    self.setIntroduction = function (content) {
      register('introduction', content);
    };

    /**
     * Add the content section.
     *
     * @param {(string|H5P.jQuery)} content
     * @param {Object} [options]
     * @param {string} [options.class]
     */
    self.setContent = function (content, options) {
      register('content', content);

      if (options && options.class) {
        sections.content.addClass(options.class);
      }
    };

    /**
     * Set feedback message.
     * Setting the message to blank or undefined will hide it again.
     *
     * @param {string}  content
     * @param {number}  score     The score
     * @param {number}  maxScore  The maximum score for this question
     */
    self.setFeedback = function (content, score, maxScore) {
      if (content) {
        $feedback = $('<div>', {
          'class': 'h5p-question-feedback-container'
        });

        if (scoreBar === undefined) {
          scoreBar = JoubelUI.createScoreBar(maxScore);
        }
        scoreBar.appendTo($feedback);
        scoreBar.setScore(score);
        content = $feedback.append($('<div>', {
          'class': 'h5p-question-feedback-content',
          html: content
        }));

        showFeedback = true;
        if (sections.feedback) {
          // Update section
          update('feedback', content);
        }
        else {
          // Create section
          register('feedback', content);
        }

        if ($wrapper) {
          // Make visible
          if (!sections.feedback.is(':visible')) {
            insert(self.order, 'feedback', sections, $wrapper);
          }

          // Show feedback section
          setTimeout(function () {
            sections.feedback.addClass('h5p-question-visible');
            setElementHeight(sections.feedback);
          }, 0);
        }
      }
      else if (sections.feedback && showFeedback) {
        showFeedback = false;

        // Hide feedback section
        sections.feedback.removeClass('h5p-question-visible');
        sections.feedback.css('max-height', 0);

        // Detach after transition
        setTimeout(function () {
          // Avoiding Transition.onTransitionEnd since it will register multiple events, and there's no way to cancel it if the transition changes back to "show" while the animation is happening.
          if (!showFeedback) {
            sections.feedback.detach();
          }
        }, 150);
      }
    };

    /**
     * Checks to see if button is registered.
     *
     * @param {string} id
     * @returns {boolean}
     */
    self.hasButton = function (id) {
      return (buttons[id] !== undefined);
    };

    /**
     * Register buttons for the task.
     *
     * @param {string} id
     * @param {string} text label
     * @param {function} clicked
     * @param {boolean} [visible=true]
     */
    self.addButton = function (id, text, clicked, visible) {
      if (buttons[id]) {
        return; // Already registered
      }

      if (sections.buttons === undefined)  {
        // We have buttons, register wrapper
        register('buttons');
      }

      var $e = buttons[id] = JoubelUI.createButton({
        'class': 'h5p-question-' + id,
        html: text,
        on: {
          click: function () {
            clicked();
          }
        }
      });
      buttonOrder.push(id);

      if (visible === undefined || visible) {
        // Button should be visible
        $e.appendTo(sections.buttons);
        sections.buttons.addClass('h5p-question-visible');
      }
    };

    /**
     * Show registered button with given identifier.
     *
     * @param {string} id
     */
    self.showButton = function (id) {
      if (buttons[id] === undefined) {
        return;
      }

      // Skip if already being shown
      if (buttonsToShow.indexOf(id) !== -1) {
        return;
      }

      // Check if button is going to be hidden on next tick
      var exists = buttonsToHide.indexOf(id);
      if (exists !== -1) {
        // Just skip hiding it
        buttonsToHide.splice(exists, 1);
        return;
      }

      // Skip if visible
      if (buttons[id].is(':visible')) {
        return;
      }

      // Show button on next tick
      buttonsToShow.push(id);
      if (!toggleButtonsTimer) {
        toggleButtonsTimer = setTimeout(toggleButtons, 0);
      }
    };

    /**
     * Hide registered button with given identifier.
     *
     * @param {string} id
     */
    self.hideButton = function (id) {
      if (buttons[id] === undefined) {
        return;
      }

      // Skip if already being hidden
      if (buttonsToHide.indexOf(id) !== -1) {
        return;
      }

      // Check if buttons is going to be shown on next tick
      var exists = buttonsToShow.indexOf(id);
      if (exists !== -1) {
        // Just skip showing it
        buttonsToShow.splice(exists, 1);
        return;
      }

      // Skip if not visible
      if (!buttons[id].is(':visible')) {
        // Make sure it is detached in case the container is hidden.
        buttons[id].detach();
        return;
      }

      // Hide button on next tick.
      buttonsToHide.push(id);
      if (!toggleButtonsTimer) {
        toggleButtonsTimer = setTimeout(toggleButtons, 0);
      }
    };

    /**
     * Set focus to the given button. If no button is given the first visible
     * button gets focused. This is useful if you lose focus.
     *
     * @param {string} [id]
     */
    self.focusButton = function (id) {
      if (id === undefined) {
        // Find first button that are not being hidden.
        for (var i in buttons) {
          var hidden = false;
          for (var j = 0; j < buttonsToHide.length; j++) {
            if (buttonsToHide[j] === i) {
              hidden = true;
              break;
            }
          }

          if (!hidden) {
            // Give that button focus
            buttons[i].focus();
            break;
          }
        }
      }
      else if (buttons[id].is(':visible')) {
        // Set focus to requested button
        buttons[id].focus();
      }
    };

    /**
     * Attach content to given container.
     *
     * @param {H5P.jQuery} $container
     */
    self.attach = function ($container) {
      // The first time we attach we also create our DOM elements.
      if ($wrapper === undefined) {
        if (self.registerDomElements !== undefined &&
           (self.registerDomElements instanceof Function ||
           typeof self.registerDomElements === 'function')) {

           // Give the question type a chance to register before attaching
           self.registerDomElements();
        }
        self.trigger('registerDomElements');
      }

      // Prepare container
      $wrapper = $container;
      $container.html('').addClass('h5p-question h5p-' + type);

      // Add sections in given order
      var $sections = $();
      for (var i = 0; i < self.order.length; i++) {
        var section = self.order[i];
        if (sections[section]) {
          $sections = $sections.add(sections[section]);
        }
      }

      // Only append once to DOM for optimal performance
      $sections.appendTo($container);
    };
  }

  // Inheritance
  Question.prototype = Object.create(EventDispatcher.prototype);
  Question.prototype.constructor = Question;

  return Question;
})(H5P.jQuery, H5P.EventDispatcher, H5P.JoubelUI);
