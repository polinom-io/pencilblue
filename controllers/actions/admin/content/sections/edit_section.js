/*

    Edits a site section
    
    @author Blake Callens <blake.callens@gmail.com>
    @copyright PencilBlue 2013, All rights reserved

*/

this.init = function(request, output)
{
    var instance = this;

    getSession(request, function(session)
    {
        if(!userIsAuthorized(session, {logged_in: true, admin_level: ACCESS_EDITOR}))
        {
            formError(request, session, '^loc_INSUFFICIENT_CREDENTIALS^', '/admin/content/sections', output);
            return;
        }
        
        var get = getQueryParameters(request);
        var post = getPostParameters(request);
        
        if(message = checkForRequiredParameters(post, ['name', 'editor']))
        {
            formError(request, session, message, '/admin/content/sections', output);
            return;
        }
        if(message = checkForRequiredParameters(get, ['id']))
        {
            formError(request, session, message, '/admin/content/sections', output);
            return;
        }
        
        getDBObjectsWithValues({object_type: 'section', _id: ObjectID(get['id'])}, function(data)
        {
            if(data.length == 0)
            {
                formError(request, session, '^loc_ERROR_SAVING^', '/admin/content/sections', output);
                return;
            }
            
            var section = data[0];
            var sectionDocument = createDocument('section', post, ['keywords'], ['url', 'parent']);
            
            if(!sectionDocument['url'])
            {
                sectionDocument['url'] = sectionDocument['name'].toLowerCase().split(' ').join('-');
            }
            
            getDBObjectsWithValues({object_type: 'section', $or: [{name: sectionDocument['name']}, {url: sectionDocument['url']}]}, function(data)
            {
                if(data.length > 0)
                {
                    for(var i = 0; i < data.length; i++)
                    {
                        if(!data[i]._id.equals(section._id))
                        {
                            formError(request, session, '^loc_EXISTING_SECTION^', '/admin/content/sections', output);
                            return;
                        }
                    }
                }
                
                editDBObject(section._id, sectionDocument, [], function(data)
                {
                    if(data.length == 0)
                    {
                        formError(request, session, '^loc_ERROR_SAVING^', '/admin/content/sections', output);
                        return;
                    }
                    
                    session.success = '^loc_SECTION_EDITED^';
                    
                    instance.checkForSectionMapUpdate(sectionDocument, function()
                    {                
                        editSession(request, session, [], function(data)
                        {        
                            output({redirect: pb.config.siteRoot + '/admin/content/sections'});
                        });
                    });
                });
            });
        });
    });
};

this.checkForSectionMapUpdate = function(sectionDocument, output)
{
    if(!sectionDocument['parent'])
    {
        output();
        return;
    }

    getDBObjectsWithValues({object_type: 'section', name: sectionDocument['name']}, function(data)
    {
        if(data.length == 0)
        {
            output();
            return;
        }
        
        var sectionUID = data[0]._id.toString();

        getDBObjectsWithValues({object_type: 'setting', key: 'section_map'}, function(data)
        {
            if(data.length == 0)
            {
                output();
            }
            
            var sectionMap = data[0].value;
            var sectionMapElement = null;
            
            for(var i = 0; i < sectionMap.length; i++)
            {
                for(var j = 0; j < sectionMap[i].children.length; j++)
                {
                    if(sectionMap[i].children[j].uid == sectionUID)
                    {
                        if(sectionMap[i].uid != sectionDocument['parent'])
                        {
                            sectionMapElement = sectionMap[i].children[j];
                            sectionMap[i].children.splice(j, 1);
                        }
                        break;
                    }
                }
            }
            
            if(!sectionMapElement)
            {
                output();
                return;
            }
            
            for(var i = 0; i < sectionMap.length; i++)
            {
                if(sectionMap[i].uid == sectionDocument['parent'])
                {
                    sectionMap[i].children.push(sectionMapElement);
                    break;
                }
            }
            
            var settingDocument = createDocument('setting', {key: 'section_map', value: sectionMap});
            editDBObject(data[0]._id, settingDocument, [], function(data)
            {
                output();
            });
        });
    });
};