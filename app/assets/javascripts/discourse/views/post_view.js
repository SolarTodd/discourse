/**
  This view renders a post.

  @class PostView
  @extends Discourse.View
  @namespace Discourse
  @module Discourse
**/
Discourse.PostView = Discourse.View.extend({
  classNames: ['topic-post', 'clearfix'],
  templateName: 'post',
  classNameBindings: ['postTypeClass',
                      'selected',
                      'post.hidden:hidden',
                      'post.deleted_at:deleted',
                      'parentPost:replies-above'],
  postBinding: 'content',

  postTypeClass: function() {
    return this.get('post.post_type') === Discourse.Site.instance().get('post_types.moderator_action') ? 'moderator' : 'regular';
  }.property('post.post_type'),

  // If the cooked content changed, add the quote controls
  cookedChanged: function() {
    var postView = this;
    Em.run.schedule('afterRender', function() {
      postView.insertQuoteControls();
    });
  }.observes('post.cooked'),

  init: function() {
    this._super();
    this.set('context', this.get('content'));
  },

  mouseUp: function(e) {
    if (this.get('controller.multiSelect') && (e.metaKey || e.ctrlKey)) {
      this.get('controller').selectPost(this.get('post'));
    }
  },

  selected: function() {
    var selectedPosts = this.get('controller.selectedPosts');
    if (!selectedPosts) return false;
    return selectedPosts.contains(this.get('post'));
  }.property('controller.selectedPostsCount'),

  selectText: function() {
    return this.get('selected') ? Em.String.i18n('topic.multi_select.selected', { count: this.get('controller.selectedPostsCount') }) : Em.String.i18n('topic.multi_select.select');
  }.property('selected', 'controller.selectedPostsCount'),

  repliesHidden: function() {
    return !this.get('repliesShown');
  }.property('repliesShown'),

  // Click on the replies button
  showReplies: function() {
    var postView = this;
    if (this.get('repliesShown')) {
      this.set('repliesShown', false);
    } else {
      this.get('post').loadReplies().then(function() {
        postView.set('repliesShown', true);
      });
    }
    return false;
  },

  // Toggle visibility of parent post
  toggleParent: function(e) {
    var postView = this;
    var $parent = this.$('.parent-post');
    if (this.get('parentPost')) {
      $('nav', $parent).removeClass('toggled');
      // Don't animate on touch
      if (Discourse.get('touch')) {
        $parent.hide();
        this.set('parentPost', null);
      } else {
        $parent.slideUp(function() { postView.set('parentPost', null); });
      }
    } else {
      var post = this.get('post');
      this.set('loadingParent', true);
      $('nav', $parent).addClass('toggled');

      Discourse.Post.loadByPostNumber(post.get('topic_id'), post.get('reply_to_post_number')).then(function(result) {
        postView.set('loadingParent', false);
        // Give the post a reference back to the topic
        result.topic = postView.get('post.topic');
        postView.set('parentPost', result);
      });
    }
    return false;
  },

  updateQuoteElements: function($aside, desc) {
    var navLink = "";
    var quoteTitle = Em.String.i18n("post.follow_quote");
    var postNumber = $aside.data('post');

    if (postNumber) {

      // If we have a topic reference
      var topicId, topic;
      if (topicId = $aside.data('topic')) {
        topic = this.get('controller.content');

        // If it's the same topic as ours, build the URL from the topic object
        if (topic && topic.get('id') === topicId) {
          navLink = "<a href='" + (topic.urlForPostNumber(postNumber)) + "' title='" + quoteTitle + "' class='back'></a>";
        } else {
          // Made up slug should be replaced with canonical URL
          navLink = "<a href='" + Discourse.getURL("/t/via-quote/") + topicId + "/" + postNumber + "' title='" + quoteTitle + "' class='quote-other-topic'></a>";
        }

      } else if (topic = this.get('controller.content')) {
        // assume the same topic
        navLink = "<a href='" + (topic.urlForPostNumber(postNumber)) + "' title='" + quoteTitle + "' class='back'></a>";
      }
    }
    // Only add the expand/contract control if it's not a full post
    var expandContract = "";
    if (!$aside.data('full')) {
      expandContract = "<i class='icon-" + desc + "' title='" + Em.String.i18n("post.expand_collapse") + "'></i>";
      $aside.css('cursor', 'pointer');
    }
    $('.quote-controls', $aside).html("" + expandContract + navLink);
  },

  toggleQuote: function($aside) {
    $aside.data('expanded',!$aside.data('expanded'));
    if ($aside.data('expanded')) {
      this.updateQuoteElements($aside, 'chevron-up');
      // Show expanded quote
      var $blockQuote = $('blockquote', $aside);
      $aside.data('original-contents',$blockQuote.html());

      var originalText = $blockQuote.text().trim();
      $blockQuote.html(Em.String.i18n("loading"));
      var topic_id = this.get('post.topic_id');
      if ($aside.data('topic')) {
        topic_id = $aside.data('topic');
      }
      Discourse.ajax("/posts/by_number/" + topic_id + "/" + ($aside.data('post'))).then(function (result) {
        var parsed = $(result.cooked);
        parsed.replaceText(originalText, "<span class='highlighted'>" + originalText + "</span>");
        $blockQuote.showHtml(parsed);
      });
    } else {
      // Hide expanded quote
      this.updateQuoteElements($aside, 'chevron-down');
      $('blockquote', $aside).showHtml($aside.data('original-contents'));
    }
    return false;
  },

  // Show how many times links have been clicked on
  showLinkCounts: function() {

    var postView = this;
    var link_counts;

    if (link_counts = this.get('post.link_counts')) {
      _.each(link_counts, function(lc) {
        if (lc.clicks > 0) {
          postView.$(".cooked a[href]").each(function() {
            var link = $(this);
            if (link.attr('href') === lc.url) {
              // don't display badge counts on category badge
              if (link.closest('.badge-category').length === 0) {
                // nor in oneboxes (except when we force it)
                if (link.closest(".onebox-result").length === 0 || link.hasClass("track-link")) {
                  link.append("<span class='badge badge-notification clicks' title='" + Em.String.i18n("topic_summary.clicks") + "'>" + lc.clicks + "</span>");
                }
              }
            }
          });
        }
      });
    }
  },

  // Add the quote controls to a post
  insertQuoteControls: function() {
    var postView = this;

    return this.$('aside.quote').each(function(i, e) {
      var $aside = $(e);
      postView.updateQuoteElements($aside, 'chevron-down');
      var $title = $('.title', $aside);

      // Unless it's a full quote, allow click to expand
      if (!($aside.data('full') || $title.data('has-quote-controls'))) {
        $title.on('click', function(e) {
          if ($(e.target).is('a')) return true;
          postView.toggleQuote($aside);
        });
        $title.data('has-quote-controls', true);
      }
    });
  },

  willDestroyElement: function() {
    Discourse.ScreenTrack.instance().stopTracking(this.$().prop('id'));
  },

  didInsertElement: function() {
    var $post = this.$();
    var post = this.get('post');
    this.showLinkCounts();

    // Track this post
    Discourse.ScreenTrack.instance().track(this.$().prop('id'), this.get('post.post_number'));

    // Add syntax highlighting
    Discourse.SyntaxHighlighting.apply($post);
    Discourse.Lightbox.apply($post);

    // Find all the quotes
    this.insertQuoteControls();

    $post.addClass('ready');
  }
});
