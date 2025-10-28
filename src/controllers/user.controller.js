import { asyncHandler } from '../utils/asyncHandler.js';
import {ApiError} from '../utils/apiError.js';
import {User} from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudnary.js';
import { ApiResponse } from '../utils/apiResponse.js';
import jwt from 'jsonwebtoken';

const generateAccessTokenAndRefreshToken = async (userId) => {
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {refreshToken, accessToken};
    }catch(err){
        throw new ApiError(500, "Something went wrong during token generation");
    }
};

const registerUser = asyncHandler( async (req, res) => {
    const {fullName, email, username, password} = req.body;

    if(
        [fullName, email, username, password].some((field)=> field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{username},{email}]
    });

    if(existedUser){
        throw new ApiError(409, "User already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;

    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage.path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar not found");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required");
    }

    const user = await User.create({
        fullName,
        username: username.toLowerCase(),
        email,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        password
    });

    const userCreated = await User.findById(user._id).select("-password -refreshToken");

    if(!userCreated){
        throw new ApiError(500, "Something went wrong during data insertion in db");
    }

    return res.status(201).json(
        new ApiResponse(200, userCreated, "User registered sucessfully")
    );

});

const loginUser = asyncHandler( async (req, res) => {
    const {username, email, password} = req.body;

    if(!(username || email)){
        throw new ApiError(400, "username or email is required");
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    });

    if(!user){
        throw new ApiError(404, "User not exist");
    }

    const isPasswordValid= await user.correctPassword(password);

    if(!isPasswordValid){
        throw new ApiError(404, "Wrong password");
    }

    const {refreshToken, accessToken} = await generateAccessTokenAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(200, {
        user: loggedInUser, accessToken, refreshToken
    },"User loggedIn successfully");

});

const logoutUser = asyncHandler( async (req,res) => {
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged out"));
});

const refreshAccessToken = asyncHandler( async (req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized access");
    }

    try{
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decodedToken?._id);

        if(!user){
            throw new ApiError(401,"Invalid Refresh Token");
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const options = {
            httpOnly: true,
            secure: true
        };

        const {accessToken, newRefreshToken} = await generateAccessTokenAndRefreshToken(user._id);

        return res.status(200)
        .cookie("accessToken", accessToken,options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken, refreshToken: newRefreshToken
                },
                "Access token refreshed"
            )
        );

    }catch(err){
        throw new ApiError(401,"Invalid refresh token");
    }
});

const changePassword = asyncHandler( async (req,res) => {
    const {newPassword, oldPassword} = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordValid = user.correctPassword(oldPassword);

    if(!isPasswordValid){
        throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res.status(200).json(new ApiResponse(200,{},"Password changed successfully"));
});

const getCurrentUser = asyncHandler( async (req,res) => {
    return res.status(200).json(200,req.user,"Current user fetched successfully");
});

const updateUserDetails = asyncHandler( async (req,res) => {
    const {fullName, email} = req.body;

    if(!fullName || !email){
        throw new ApiError(400, "Fullname or email not found");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {
            new: true
        }
    ).select("-password");

    return res.status(200).json(new ApiResponse(200, "User details updated"));
});

const updateAvatar = asyncHandler( async (req,res) => {
    const newAvatarPath = req.file?.path;

    if(!newAvatarPath){
        throw new ApiError(401, "Avatar path not found");
    }

    const avatar = await uploadOnCloudinary(newAvatarPath);

    if(!avatar.url){
        throw new ApiError(401, "Avatar URL not found");
    }

    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password");

    return res.status(200).json(new ApiResponse(200, "Avatar Changed Successfully"));

});

const updateCoverImage = asyncHandler( async (req,res) => {
    const newCoverImagePath = req.file?.path;

    if(!newCoverImagePath){
        throw new ApiError(401, "Cover Image path not found");
    }

    const coverImage = await uploadOnCloudinary(newCoverImagePath);

    if(!coverImage.url){
        throw new ApiError(401, "Cover Image URL not found");
    }

    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password");

    return res.status(200).json(new ApiResponse(200, "Cover Image changed successfully"));

});

const getUserChannelProfile = asyncHandler( async (req,res) => {
    const {username} = req.params;

    if(!username?.trim()){
        throw new ApiError(400, "username is missing");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscribers",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscribers",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelSubscribeToCount: {
                    $size: "subscribedTo"
                }
            }
        }
    ]);
});

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    getCurrentUser,
    updateUserDetails,
    updateAvatar,
    updateCoverImage,
    getUserChannelProfile,
};
                                                       